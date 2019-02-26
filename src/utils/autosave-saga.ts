import {
  call,
  cancel,
  fork,
  join,
  take,
  put,
  select,
  CallEffect,
} from 'redux-saga/effects';
import { DataStore } from '../store/DataStore';
import { Action } from 'redux';
import { Task } from 'redux-saga';
import { delay } from 'redux-saga/effects';

export interface ResourceState<Resource, SaveContext> {
  context: SaveContext;
  needsSaving: boolean;
  resource: Partial<Resource>;
}

export interface ResourceParams<
  EditAction extends Action,
  SaveAction extends Action,
  FinishSaveAction extends Action,
  DeleteAction extends Action,
  ReduxState,
  Resource extends object,
  SaveContext
> {
  editActionType: string;
  saveActionType: string;
  deleteActionType: string;
  resourceStateSelector: (
    action: EditAction | SaveAction | DeleteAction
  ) => (state: ReduxState) => ResourceState<Resource, SaveContext> | undefined;
  delete: (
    dataStore: DataStore,
    action: DeleteAction,
    resource: Partial<Resource>
  ) => CallEffect | undefined;
  save: (
    dataStore: DataStore,
    saveContext: SaveContext,
    resource: Partial<Resource>
  ) => IterableIterator<any>;
  // ^ The above should be IterableIterator<Partial<Resource>> but we're still
  // waiting on typing for return values from generators: Typescript #2983
  saveActionCreator: (saveContext: SaveContext) => SaveAction;
  finishSaveActionCreator: (
    saveContext: SaveContext,
    resource: Partial<Resource>
  ) => FinishSaveAction;
}

export function* watchEdits<
  EditAction extends Action,
  SaveAction extends Action,
  FinishSaveAction extends Action,
  DeleteAction extends Action,
  ReduxState,
  Resource extends object,
  SaveContext
>(
  dataStore: DataStore,
  autoSaveDelay: number,
  params: ResourceParams<
    EditAction,
    SaveAction,
    FinishSaveAction,
    DeleteAction,
    ReduxState,
    Resource,
    SaveContext
  >
) {
  const autoSaveTasks: Map<string, Task> = new Map();
  const saveTasks: Map<string, Task> = new Map();

  // Define a method for uniquely identifying a resource and its context so that
  // we can store state associated with it (e.g. its save progress).
  //
  // Importantly, if we have a newId for the resource we should prefer to use
  // that over the resourceId. A particular resource might start life with only
  // a newId but then gain a resourceId once it is saved. By sticking with the
  // newId we maintain a consistent identifer for the resource-context.
  const getContextKey = (context: SaveContext): string => {
    // For objects write out a value-value-value type string
    if (typeof context === 'object') {
      return Object.values(context)
        .filter(value => typeof value !== 'undefined')
        .join('-');
    }

    // Otherwise just stringify the thing.
    return String(context);
  };

  while (true) {
    const action = yield take([
      params.editActionType,
      params.saveActionType,
      params.deleteActionType,
    ]);

    const resourceState:
      | ResourceState<Resource, SaveContext>
      | undefined = yield select(params.resourceStateSelector(action));

    if (!resourceState) {
      continue;
    }

    let resource = resourceState.resource;
    const saveContext = resourceState.context;

    // Check if anything needs saving.
    const shouldSave =
      action.type === params.deleteActionType || resourceState.needsSaving;
    if (!shouldSave) {
      // If we are responding to a save action, put the finish action anyway
      // in case someone is waiting on either a finished or fail to indicate
      // completion of the save.
      if (action.type === params.saveActionType) {
        yield put(params.finishSaveActionCreator(saveContext, resource));
      }
      continue;
    }

    const taskKey = getContextKey(resourceState.context);

    // If there is an auto save in progress, cancel it.
    if (autoSaveTasks.has(taskKey)) {
      const autoSaveTask = autoSaveTasks.get(taskKey)!;
      if (autoSaveTask.isRunning()) {
        yield cancel(autoSaveTask);
      }
      autoSaveTasks.delete(taskKey);
    }

    // If there is a save in progress, let it finish.
    if (saveTasks.has(taskKey)) {
      const saveTask = saveTasks.get(taskKey)!;
      try {
        const updatedResource: Partial<Resource> = yield join(saveTask);
        // Merge the updated resource with the current one. We want the ID from
        // the updated resource but otherwise we want the changes being
        // passed-in.
        //
        // We'd like to do:
        //
        //   resource = { ...updatedResource, ...resource };
        //
        // But TypeScript #10727 :(
        resource = Object.assign({}, updatedResource, resource);
      } catch (error) {
        // If the previous save failed, just ignore it. It will have
        // dispatched a suitable error action.
      }
      saveTasks.delete(taskKey);
    }

    switch (action.type) {
      case params.editActionType:
        autoSaveTasks.set(
          taskKey,
          yield fork(
            autoSave,
            autoSaveDelay,
            saveContext,
            params.saveActionCreator
          )
        );
        break;

      case params.saveActionType:
        const saveTask = function*() {
          const result: Partial<Resource> = yield call(
            params.save,
            dataStore,
            saveContext,
            resource
          );
          saveTasks.delete(taskKey);
          return result;
        };
        saveTasks.set(taskKey, yield fork(saveTask));
        break;

      case params.deleteActionType:
        try {
          yield params.delete(dataStore, action, resource);
        } catch (error) {
          console.error(`Failed to delete resource: ${JSON.stringify(error)}`);
        }
        break;

      default:
        console.error(`Unexpected action ${action.type}`);
        break;
    }
  }
}

function* autoSave<SaveContext, SaveAction extends Action>(
  autoSaveDelay: number,
  saveContext: SaveContext,
  saveActionCreator: (saveContext: SaveContext) => SaveAction
) {
  yield delay(autoSaveDelay);
  yield put(saveActionCreator(saveContext));
}
