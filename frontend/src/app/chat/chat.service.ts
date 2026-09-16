import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Talks to the NestJS RAG endpoint and the n8n feedback webhook.

export interface ChatSource {
  title: string;
  sourceUrl: string | null;
}

export interface AskResponse {
  answer: string;
  sources: ChatSource[];
  sessionId: string;
  messageId: string;
}

export type FeedbackRating = 'up' | 'down';

export interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[] | null;
  createdAt: string;
}

const ASK_URL = 'http://localhost:3000/chat/ask';
const FEEDBACK_URL = 'http://localhost:5678/webhook/kindix/feedback';
const HISTORY_URL = 'http://localhost:3000/conversation/history';

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private readonly http: HttpClient) {}

  ask(query: string, sessionId?: string): Observable<AskResponse> {
    return this.http.post<AskResponse>(ASK_URL, { query, sessionId });
  }

  sendFeedback(messageId: string, rating: FeedbackRating): Observable<unknown> {
    return this.http.post(FEEDBACK_URL, { messageId, rating });
  }

  getHistory(sessionId: string): Observable<HistoryMessage[]> {
    return this.http.get<HistoryMessage[]>(HISTORY_URL, { params: { sessionId } });
  }
}
