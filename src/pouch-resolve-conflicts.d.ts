/// <reference types="pouchdb-core" />
declare namespace PouchDB {
  interface Database<Content extends {} = {}> {
    /**
     * Recursively call a function until all conflicts are resolved for a given
     * document. Returns a Promise.
     *
     * @param doc - the document on which to resolve conflicts
     * @param resolveFun - function that takes two conflicting documents
     * and returns either one of them, a changed version of one of them, or
     * nothing. In the latter the conflict will not be resolved. If there are
     * more than two conflicting versions this function will be called with each
     * version against the former result.
     */
    resolveConflicts<Model>(
      doc: Core.Document<Content & Model> & Core.GetMeta,
      diffFun: ResolveConflictsCallback<Content & Model>
    ): Promise<Core.Response[]>;
  }

  type ResolveConflictsCallback<Content extends {}> = (
    a: Core.Document<Content>,
    b: Core.Document<Content>
  ) => Core.Document<Content> | undefined;
}

declare module 'pouch-resolve-conflicts' {
  const plugin: PouchDB.Plugin;
  export = plugin;
}
