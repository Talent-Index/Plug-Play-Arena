import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Radio } from 'lucide-react';
import { toast } from 'sonner';

const TOPICS = ['avalanche_basics','stablecoins','defi','subnets','nfts','wallets','consensus'];

type Session = {
  id: string;
  join_code: string;
  status: string;
  current_question_index: number;
  host_user_id: string;
  created_at: string;
};

type Question = {
  id: string;
  topic: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  difficulty: string;
};

type QForm = {
  topic: string;
  question: string;
  opt_a: string; opt_b: string; opt_c: string; opt_d: string;
  answer: string;
  explanation: string;
};

const QEMPTY: QForm = {
  topic: 'avalanche_basics', question: '', opt_a: '', opt_b: '', opt_c: '', opt_d: '',
  answer: '0', explanation: '',
};

export default function AdminArena() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [qLoading, setQLoading] = useState(true);
  const [qOpen, setQOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<Question | null>(null);
  const [qForm, setQForm] = useState<QForm>(QEMPTY);
  const [savingQ, setSavingQ] = useState(false);
  const [topicFilter, setTopicFilter] = useState('all');

  function fetchSessions() {
    setSessionsLoading(true);
    supabase.from('game_sessions').select('*').order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { if (data) setSessions(data as unknown as Session[]); setSessionsLoading(false); });
  }

  function fetchQuestions() {
    setQLoading(true);
    supabase.from('arena_questions').select('*').order('topic')
      .then(({ data }) => { if (data) setQuestions(data as unknown as Question[]); setQLoading(false); });
  }

  useEffect(() => { fetchSessions(); fetchQuestions(); }, []);

  async function endSession(id: string) {
    if (!confirm('End this arena session?')) return;
    const { error } = await supabase.from('game_sessions').update({ status: 'ended' }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Session ended.'); fetchSessions(); }
  }

  function openCreateQ() { setEditingQ(null); setQForm(QEMPTY); setQOpen(true); }
  function openEditQ(q: Question) {
    setEditingQ(q);
    const answerIdx = q.options.findIndex(o => o === q.correct_answer);
    setQForm({
      topic: q.topic, question: q.question_text,
      opt_a: q.options[0] ?? '', opt_b: q.options[1] ?? '',
      opt_c: q.options[2] ?? '', opt_d: q.options[3] ?? '',
      answer: String(Math.max(0, answerIdx)), explanation: '',
    });
    setQOpen(true);
  }

  async function saveQuestion() {
    setSavingQ(true);
    const options = [qForm.opt_a, qForm.opt_b, qForm.opt_c, qForm.opt_d];
    const answerIdx = parseInt(qForm.answer) || 0;
    const payload = {
      topic: qForm.topic,
      question_text: qForm.question,
      options,
      correct_answer: options[answerIdx] ?? '',
    };
    const { error } = editingQ
      ? await supabase.from('arena_questions').update(payload).eq('id', editingQ.id)
      : await supabase.from('arena_questions').insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(editingQ ? 'Question updated.' : 'Question added.'); setQOpen(false); fetchQuestions(); }
    setSavingQ(false);
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Delete this question?')) return;
    const { error } = await supabase.from('arena_questions').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted.'); fetchQuestions(); }
  }

  const fq = (k: keyof QForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setQForm(p => ({ ...p, [k]: e.target.value }));

  const filteredQs = topicFilter === 'all' ? questions : questions.filter(q => q.topic === topicFilter);

  const STATUS_PILL: Record<string, string> = {
    waiting: 'bg-yellow-500/15 text-yellow-400',
    lobby:   'bg-yellow-500/15 text-yellow-400',
    active:  'bg-green-500/15 text-green-400',
    ended:   'bg-muted/50 text-muted-foreground',
  };

  return (
    <div className="p-8 space-y-10">
      {/* Sessions */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <Radio className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl tracking-wider">Arena Sessions</h1>
          <span className="text-sm text-muted-foreground">({sessions.length} recent)</span>
        </div>

        {sessionsLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Topic</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Round</th>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">No arena sessions yet.</td></tr>
                ) : sessions.map(s => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{s.join_code}</td>
                    <td className="px-4 py-3 text-xs capitalize">—</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_PILL[s.status] ?? ''}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{s.current_question_index}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      {s.status !== 'ended' && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive text-xs" onClick={() => endSession(s.id)}>
                          End
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Questions */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl tracking-wider">Quiz Questions</h2>
            <p className="mt-1 text-sm text-muted-foreground">{questions.length} questions across {new Set(questions.map(q => q.topic)).size} topics</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={topicFilter}
              onChange={e => setTopicFilter(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
            >
              <option value="all">All topics</option>
              {TOPICS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <Button onClick={openCreateQ} className="gap-2"><Plus className="h-4 w-4" /> New Question</Button>
          </div>
        </div>

        {qLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 text-left">Question</th>
                  <th className="px-4 py-3 text-left">Topic</th>
                  <th className="px-4 py-3 text-left">Answer</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredQs.map(q => (
                  <tr key={q.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 max-w-xs">
                      <div className="truncate">{q.question_text}</div>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground">{q.topic.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-xs text-green-400">{q.correct_answer}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditQ(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteQuestion(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={qOpen} onOpenChange={setQOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-wider">{editingQ ? 'Edit Question' : 'New Question'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Row label="Topic">
              <select value={qForm.topic} onChange={fq('topic')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                {TOPICS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </Row>
            <Row label="Question"><Textarea value={qForm.question} onChange={fq('question')} rows={2} /></Row>
            <div className="grid grid-cols-2 gap-3">
              <Row label="Option A"><Input value={qForm.opt_a} onChange={fq('opt_a')} /></Row>
              <Row label="Option B"><Input value={qForm.opt_b} onChange={fq('opt_b')} /></Row>
              <Row label="Option C"><Input value={qForm.opt_c} onChange={fq('opt_c')} /></Row>
              <Row label="Option D"><Input value={qForm.opt_d} onChange={fq('opt_d')} /></Row>
            </div>
            <Row label="Correct Answer (0=A, 1=B, 2=C, 3=D)">
              <select value={qForm.answer} onChange={fq('answer')} className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm">
                {['0','1','2','3'].map(v => <option key={v} value={v}>{v} ({['A','B','C','D'][+v]})</option>)}
              </select>
            </Row>
            <Row label="Explanation (optional)"><Input value={qForm.explanation} onChange={fq('explanation')} /></Row>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQOpen(false)}>Cancel</Button>
            <Button onClick={saveQuestion} disabled={savingQ || !qForm.question}>{savingQ ? 'Saving…' : 'Save Question'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label className="text-xs text-muted-foreground">{label}</label>{children}</div>;
}
