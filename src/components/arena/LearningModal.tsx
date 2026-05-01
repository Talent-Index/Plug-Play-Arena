import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function LearningModal({ open, onOpenChange, title, body }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; body: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display tracking-wider">📚 {title}</DialogTitle>
          <DialogDescription className="pt-2 text-sm">{body}</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}