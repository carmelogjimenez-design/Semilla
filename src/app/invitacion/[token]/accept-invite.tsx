'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Field, TextInput } from '@/components/ui/primitives';
import { createClient } from '@/lib/supabase/client';

export function AcceptInvite({ token, displayName }: { token: string; displayName: string }) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc('accept_invite', {
      p_token: token,
      p_display_name: name.trim(),
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message.replace(/^.*?:\s*/, ''));
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Field label="Cómo quieres aparecer">
        <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Sara" />
      </Field>
      {error ? <p className="text-[13px] font-medium text-coral-deep">{error}</p> : null}
      <Button full onClick={join} disabled={busy}>
        {busy ? 'Entrando…' : 'Unirme'}
      </Button>
    </div>
  );
}
