import { describe, it, expect, vi, beforeEach } from 'vitest';

const { uploadMock, upsertMock, getUserMock } = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  upsertMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ upload: uploadMock }) },
    auth: { getUser: getUserMock },
    from: () => ({ upsert: upsertMock }),
  },
}));
vi.mock('@/src/lib/reportIndexedDB', () => ({ enqueue: vi.fn() }));

import { uploadAndLinkAttachment } from '@/src/services/reportService';

const job = {
  reportId: 'rep-1',
  teamId: 'team-1',
  technicianId: 'tech-1',
  attachmentId: 'att-1',
  file: new File([new Blob(['x'])], 'foto.jpg', { type: 'image/jpeg' }),
  caption: 'legenda',
};

beforeEach(() => {
  uploadMock.mockReset().mockResolvedValue({ error: null });
  upsertMock.mockReset().mockResolvedValue({ error: null });
  getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'tech-1' } } });
});

describe('uploadAndLinkAttachment (re-enfileiramento de anexo)', () => {
  it('faz upload (upsert) e vincula em report_attachments com uploaded_by = auth.uid()', async () => {
    await uploadAndLinkAttachment(job);

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [path, , opts] = uploadMock.mock.calls[0];
    expect(path).toBe('team-1/reports/rep-1/attachments/att-1.jpg');
    expect(opts).toMatchObject({ upsert: true });

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const [row, conflict] = upsertMock.mock.calls[0];
    expect(row).toMatchObject({ id: 'att-1', report_id: 'rep-1', uploaded_by: 'tech-1', caption: 'legenda' });
    expect(conflict).toEqual({ onConflict: 'id' });
  });

  it('lança se o upload falhar — vira retry na fila, sem inserir linha órfã', async () => {
    uploadMock.mockResolvedValue({ error: { message: 'storage indisponível' } });
    await expect(uploadAndLinkAttachment(job)).rejects.toBeTruthy();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('lança se o vínculo em report_attachments falhar (ex.: RLS)', async () => {
    upsertMock.mockResolvedValue({ error: { message: 'violates row-level security' } });
    await expect(uploadAndLinkAttachment(job)).rejects.toBeTruthy();
  });
});
