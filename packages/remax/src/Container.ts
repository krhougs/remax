import VNode, { Path, RawNode } from './VNode';
import { generate } from './instanceId';
import { FiberRoot } from 'react-reconciler';

interface SpliceUpdate {
  path: Path;
  start: number;
  deleteCount: number;
  items: RawNode[];
}

interface TreeUpdateSplice {
  path: Path;
  start: number;
  deleteCount: number;
  item: RawNode;
}

export default class Container {
  context: any;
  root: VNode;
  updateQueue: SpliceUpdate[] = [];
  _rootContainer?: FiberRoot;
  stopUpdate?: boolean;
  currentSetDataPromise: Promise<any>;
  tree?: any;

  constructor(context: any) {
    this.context = context;

    this.root = new VNode({
      id: generate(),
      type: 'root',
      container: this,
    });
    this.root.mounted = true;
    this.currentSetDataPromise = Promise.resolve();
    this.tree = {
      root: { children: [] },
    };
  }

  requestUpdate(
    path: Path,
    start: number,
    deleteCount: number,
    immediately: boolean,
    ...items: RawNode[]
  ) {
    const update: SpliceUpdate = {
      path,
      start,
      deleteCount,
      items,
    };
    if (immediately) {
      this.updateQueue.push(update);
      this.applyUpdate();
    } else {
      if (this.updateQueue.length === 0) {
        Promise.resolve().then(() => this.applyUpdate());
      }
      this.updateQueue.push(update);
    }
  }

  applyUpdate() {
    if (this.stopUpdate) {
      return;
    }

    const applyTime = new Date().getTime();
    this.currentSetDataPromise = this.currentSetDataPromise
      .then(
        () =>
          new Promise(resolve => {
            if (this.updateQueue.length === 0) {
              if (process.env.REMAX_DEBUG) {
                console.log('queue empty, ignore.');
              }
              return resolve();
            }
            if (this.stopUpdate) {
              if (process.env.REMAX_DEBUG) {
                console.log('component unmounted, ignore.');
              }
              return resolve();
            }

            const splices: TreeUpdateSplice[] = this.updateQueue.map(
              update => ({
                path: update.path,
                start: update.start,
                deleteCount: update.deleteCount,
                item: update.items[0],
              })
            );
            this.updateQueue = [];
            this.updateTree(splices);
            const updateTime = new Date().getTime();
            this.context.setData({ tree: this.tree }, () => {
              if (process.env.REMAX_DEBUG) {
                console.log(
                  'setData:',
                  `applied ${new Date().getTime() - applyTime}ms ago`,
                  `updated ${new Date().getTime() - updateTime}ms ago`,
                  `updated splice length ${splices.length}`,
                  `updateQueue length ${this.updateQueue.length}`
                );
              }
              resolve();
            });
          })
      )
      .catch(e => {
        console.warn(e);
      });
  }

  updateTree(splices: TreeUpdateSplice[]) {
    for (let i = 0; i < splices.length; i += 1) {
      const value = get(this.tree, splices[i].path);
      if (splices[i].item) {
        value.splice(splices[i].start, splices[i].deleteCount, splices[i].item);
      } else {
        value.splice(splices[i].start, splices[i].deleteCount);
      }
      set(this.tree, splices[i].path, value);
    }
  }

  clearUpdate() {
    this.stopUpdate = true;
  }

  createCallback(name: string, fn: Function) {
    this.context[name] = fn;
  }

  appendChild(child: VNode) {
    this.root.appendChild(child, true);
  }

  removeChild(child: VNode) {
    this.root.removeChild(child, true);
  }

  insertBefore(child: VNode, beforeChild: VNode) {
    this.root.insertBefore(child, beforeChild, true);
  }
}

function get(obj: any, path: Path) {
  let nextObj = obj;

  for (let i = 0; i < path.length; i += 1) {
    const currentPath = path[i];
    nextObj = nextObj[currentPath];
    if (nextObj === undefined) {
      nextObj = currentPath == 'children' ? [] : {};
    }
  }

  return nextObj;
}

function set(obj: any, path: Path, value: any) {
  if (path.length === 1) {
    obj[path[0]] = value;
  }

  const nextObj = obj;

  for (let i = 0; i < path.length; i += 1) {
    const currentPath = path[i];
    const currentValue = nextObj[currentPath];

    if (currentValue === undefined) {
      // check if we assume an array
      nextObj[currentPath] = typeof path[i + 1] === 'number' ? [] : {};
    }
  }
}
