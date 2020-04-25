import { Action } from '../core-actions/Action';
export interface DeleteItemsActionOptions {
    keyCodes?: number[];
}
/**
 * Deletes all selected items
 */
export declare class DeleteItemsAction extends Action {
    constructor(options?: DeleteItemsActionOptions);
}
