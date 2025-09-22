import { ConflictResolutionChoice } from "packages/core/api/syncAPI";
import { ConflictDialog, ConflictInfo } from "../../../packages/core/services/conflictResolver";

export class ElectronConflictDialog implements ConflictDialog {
    presentConflictDialog(conflictInfo: ConflictInfo, serverContent: string) {
        return new Promise<ConflictResolutionChoice>((resolve, reject) => {
            const event = new CustomEvent('showConflictDialog', {
                detail: { conflictInfo, serverContent, resolve, reject }
            });
            window.dispatchEvent(event);
        });
    }
}