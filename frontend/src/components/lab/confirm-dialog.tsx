import { btnGhost, btnPrimary, dialogSurface } from '@/components/app/styles'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { closeConfirm, useConfirmStore } from '@/store/confirm-store'
import { t } from '@/i18n'

/** The lab's confirmation for delete actions; requests come from `askConfirm` / `confirmDelete`. */
export function ConfirmDialog() {
  const req = useConfirmStore((s) => s.req)
  return (
    <AlertDialog open={!!req} onOpenChange={(o) => !o && closeConfirm()}>
      <AlertDialogContent className={dialogSurface}>
        <AlertDialogHeader className="place-items-start text-left">
          <AlertDialogTitle className="text-base font-strong">{req?.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] text-muted-foreground">{req?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="-mx-5 -mb-5 rounded-none border-t border-rule bg-transparent p-4">
          <AlertDialogCancel className={btnGhost}>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className={btnPrimary}
            onClick={() => {
              req?.onConfirm()
              closeConfirm()
            }}
          >
            {req?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
