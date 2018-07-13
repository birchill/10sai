import {
  fork,
  take,
  select,
  put,
  CallEffect,
  race,
  call,
} from 'redux-saga/effects';
import DataStore from '../store/DataStore';
import { Action } from 'redux';
import { Task, delay } from 'redux-saga';

export interface SaveContextBase {
  newId?: number;
  resourceId?: string;
}

export interface ResourceState<Resource, SaveContext extends SaveContextBase> {
  context: SaveContext;
  deleted: boolean;
  dirty: boolean;
  resource: Partial<Resource>;
}

export interface ResourceParams<
  EditAction extends Action,
  SaveAction extends Action,
  FinishSaveAction extends Action,
  CancelSaveAction extends Action,
  DeleteAction extends Action,
  ReduxState,
  Resource,
  SaveContext
> {
  editActionType: string;
  saveActionType: string;
  deleteActionType: string;
  cancelAutoSaveActionType: string;
  resourceStateSelector: (
    action: EditAction | SaveAction | DeleteAction
  ) => ((state: ReduxState) => ResourceState<Resource, SaveContext>);
  hasDataToSave: (resource: Partial<Resource>) => boolean;
  delete: (dataStore: DataStore, resourceId: string) => CallEffect;
  save: (
    dataStore: DataStore,
    resourceState: ResourceState<Resource, SaveContext>
  ) => IterableIterator<any>; // Still waiting on typing for return values: Typescript #2983
  finishSaveActionCreator: (
    saveContext: SaveContext,
    resource: Partial<Resource>
  ) => FinishSaveAction;
  cancelSaveActionCreator: (saveContext: SaveContext) => CancelSaveAction;
}

export function* watchEdits<
  EditAction extends Action,
  SaveAction extends Action,
  FinishSaveAction extends Action,
  CancelSaveAction extends Action,
  DeleteAction extends Action,
  ReduxState,
  Resource,
  SaveContext extends SaveContextBase
>(
  dataStore: DataStore,
  autoSaveDelay: number,
  params: ResourceParams<
    EditAction,
    SaveAction,
    FinishSaveAction,
    CancelSaveAction,
    DeleteAction,
    ReduxState,
    Resource,
    SaveContext
  >
) {
  const autoSaveTasks: Map<string, Task> = new Map();

  // Define a method for uniquely identifying a resource and its context so that
  // we can store state associated with it (e.g. its save progress).
  //
  // Importantly, if we have a newId for the resource we should prefer to use
  // that over the resourceId. A particular resource might start life with only
  // a newId but then gain a resourceId once it is saved. By sticking with the
  // newId we maintain a consistent identifer for the resource-context.
  const getContextKey = (context: SaveContext): string => {
    return Object.entries(context)
      .map(
        ([field, value]) =>
          field === 'resourceId' && typeof context.newId === 'number'
            ? undefined
            : value
      )
      .filter(value => typeof value !== 'undefined')
      .join('-');
  };

  while (true) {
    const action = yield take([
      params.editActionType,
      params.saveActionType,
      params.deleteActionType,
    ]);

    const resourceState: ResourceState<Resource, SaveContext> = yield select(
      params.resourceStateSelector(action)
    );
    let resourceId = resourceState.context.resourceId;

    // Check if anything needs saving.
    const shouldSave =
      action.type === params.deleteActionType ||
      (resourceState.dirty && params.hasDataToSave(resourceState.resource));
    if (!shouldSave) {
      // If we are responding to a save action, put the finish action anyway
      // in case someone is waiting on either a finished or fail to indicate
      // completion of the save.
      if (action.type === params.saveActionType) {
        yield put(
          params.finishSaveActionCreator(
            resourceState.context,
            resourceState.resource
          )
        );
      }
      continue;
    }

    const taskKey = getContextKey(resourceState.context);

    // If there is an auto save in progress, cancel it.
    if (autoSaveTasks.has(taskKey)) {
      const autoSaveTask = autoSaveTasks.get(taskKey)!;
      if (autoSaveTask.isRunning()) {
        yield put(params.cancelSaveActionCreator(resourceState.context));
      }
      // Get the possibly updated card ID.
      try {
        resourceId = yield autoSaveTask.done;
      } catch (error) {
        // If the previous auto-save failed, just ignore it. It will have
        // dispatched a suitable error action.
      }
      autoSaveTasks.delete(taskKey);
    }

    resourceState.context.resourceId = resourceId;

    switch (action.type) {
      case params.editActionType:
        autoSaveTasks.set(
          taskKey,
          yield fork(
            autoSave,
            dataStore,
            autoSaveDelay,
            resourceState,
            params.save,
            params.cancelAutoSaveActionType
          )
        );
        break;

      case params.saveActionType:
        try {
          yield params.save(dataStore, resourceState);
        } catch (error) {
          // Don't do anything
        }
        break;

      case params.deleteActionType:
        const isDeleted = resourceState.deleted;
        if (isDeleted && typeof resourceId === 'string') {
          try {
            yield params.delete(dataStore, resourceId);
          } catch (error) {
            console.error(
              `Failed to delete resource: ${JSON.stringify(error)}`
            );
          }
        }
        break;

      default:
        console.error(`Unexpected action ${action.type}`);
        break;
    }
  }
}

function* autoSave<Resource, SaveContext extends SaveContextBase>(
  dataStore: DataStore,
  autoSaveDelay: number,
  resourceState: ResourceState<Resource, SaveContext>,
  save: (
    dataStore: DataStore,
    resourceState: ResourceState<Resource, SaveContext>
  ) => any,
  cancelAutoSaveActionType: string
) {
  // Debounce -- we allow this part of the task to be cancelled
  const { wait, cancel } = yield race({
    wait: call(delay, autoSaveDelay),
    cancel: take(cancelAutoSaveActionType),
  });

  // XXX This needs to test the cancelAutoSaveAction matches our context
  // (Do a deep equal on the context stuff.)

  if (cancel) {
    return resourceState.context.resourceId;
  }

  // The remaining steps should not be canceled since otherwise we risk
  // writing the resource twice with different IDs.
  try {
    return yield save(dataStore, resourceState);
  } catch (error) {
    // Nothing special to do here. We'll have already dispatched the appropriate
    // action and that's enough for auto-saving.
    return resourceState.context.resourceId;
  }
}
