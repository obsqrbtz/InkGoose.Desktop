import { useEffect } from 'react';
import { useAppStore } from '../store';
import { useToggle } from './useCommon';

export const useConflictResolution = () => {
    const { syncConflicts } = useAppStore();
    const { value: conflictModalOpen, setTrue: openConflictModal, setFalse: closeConflictModal } = useToggle();

    const selectedConflict = syncConflicts.length > 0 ? syncConflicts[0] : null;

    useEffect(() => {
        if (syncConflicts.length > 0 && !conflictModalOpen) {
            openConflictModal();
        }
    }, [syncConflicts, conflictModalOpen, openConflictModal]);

    const handleConflictModalClose = () => {
        closeConflictModal();

        setTimeout(() => {
            const remainingConflicts = syncConflicts.filter(c => c.id !== selectedConflict?.id);
            if (remainingConflicts.length > 0) {
                openConflictModal();
            }
        }, 500);
    };

    return {
        selectedConflict,
        conflictModalOpen,
        handleConflictModalClose
    };
};