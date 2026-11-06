import SQLiteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  createPdfTextAnchor,
  type ReaderChatMessage,
  type ReaderChatState,
} from '@yomitomo/shared';
import { expect, it, vi } from 'vitest';
import { migrations } from '../db/migrations';
import * as schema from '../db/schema';
import type { StoreDatabase } from '../store/store-db';
import { createAssistantChannelSources, type ChannelReply } from './assistant-channel-sources';

let database: StoreDatabase;
vi.mock('../store/store-db', () => ({ getDatabase: () => database }));

const articleId = 'paper_1';
const now = '2026-11-06T00:00:00.000Z';

function pdfQuestion(id: string, pageIndex: number): ReaderChatMessage {
  const anchor = createPdfTextAnchor({
    pageText: `${id}\nNearby page text`,
    pageIndex,
    start: 0,
    end: id.length,
    pageWidth: 600,
    pageHeight: 800,
    rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.05 }],
  });
  return {
    id,
    role: 'user',
    content: 'Explain the selected method',
    createdAt: now,
    context: {
      sourceType: 'pdf',
      quote: id,
      locationLabel: `Page ${pageIndex + 1}`,
      title: 'Paper',
      anchor,
      nearbyText: 'Nearby page text',
    },
  };
}

it('saves the triggering PDF selection even after a later selection has been stored', () => {
  const sqlite = new SQLiteDatabase(':memory:');
  try {
    for (const migration of migrations) sqlite.exec(migration.sql);
    database = drizzle(sqlite, { schema });
    const initial = pdfQuestion('first selection', 0);
    const later = pdfQuestion('later selection', 1);
    const otherSession = pdfQuestion('other session selection', 2);
    const sessionMetadata = { articleId, createdAt: now, updatedAt: now };
    const sessions = [
      { ...sessionMetadata, id: 'current', messages: [initial, later] },
      { ...sessionMetadata, id: 'other', messages: [otherSession] },
    ];
    database
      .insert(schema.articles)
      .values({
        id: articleId,
        sourceType: 'pdf',
        url: 'file:///paper.pdf',
        canonicalUrl: 'file:///paper.pdf',
        title: 'Paper',
        contentHash: 'paper',
        createdAt: now,
        updatedAt: now,
        readerChatState: {
          articleId,
          activeSessionId: 'current',
          sessions,
          createdAt: now,
          updatedAt: now,
        },
      })
      .run();

    const { publishReply } = createAssistantChannelSources(() => {});
    const channel = { kind: 'chat', sessionId: 'current' } as const;
    const reply: ChannelReply = {
      id: 'answer',
      author: { kind: 'agent', agentId: 'agent', username: 'agent' },
      content: 'Method explanation',
      createdAt: now,
    };
    expect(publishReply(articleId, channel, reply, initial.id)).toBe(true);
    expect(publishReply(articleId, channel, { ...reply, id: 'legacy' })).toBe(true);
    expect(
      publishReply(articleId, channel, { ...reply, id: 'wrong-session' }, otherSession.id),
    ).toBe(true);

    const state = database.select().from(schema.articles).get()?.readerChatState as ReaderChatState;
    const answers = state.sessions
      .find((session) => session.id === channel.sessionId)
      ?.messages.slice(2);
    expect(answers?.map((message) => message.context)).toEqual([
      {
        sourceType: 'pdf',
        quote: initial.context?.quote,
        locationLabel: initial.context?.locationLabel,
        title: initial.context?.title,
        anchor: initial.context?.anchor,
      },
      undefined,
      undefined,
    ]);
  } finally {
    sqlite.close();
  }
});
