import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatSource, FeedbackRating } from './chat.service';
import { ChatListEntry, SessionStoreService } from './session-store.service';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: ChatSource[];
  messageId?: string;
  feedback?: FeedbackRating | null;
  feedbackPending?: boolean;
  feedbackError?: boolean;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class ChatComponent implements OnInit {
  @ViewChild('messagesEl') private messagesEl?: ElementRef<HTMLDivElement>;

  protected get hasMessages(): boolean {
    return this.messages.length > 0;
  }

  protected messages: ChatMessage[] = [];
  protected chatList: ChatListEntry[] = [];
  protected draft = '';
  protected loading = false;
  protected historyLoading = false;
  protected error: string | null = null;
  protected logoFailed = false;
  protected sidebarOpen = true;

  protected sessionId?: string;

  constructor(
    private readonly chatService: ChatService,
    private readonly sessionStore: SessionStoreService,
  ) {}

  ngOnInit(): void {
    this.refreshChatList();

    const active = this.sessionStore.getActiveSession();
    if (active && this.sessionStore.isFresh(active)) {
      this.loadSession(active.sessionId);
    } else {
      this.sessionStore.clearActiveSession();
    }
  }

  protected send(): void {
    const query = this.draft.trim();
    if (!query || this.loading || this.historyLoading) {
      return;
    }

    this.error = null;
    this.messages.push({ id: crypto.randomUUID(), role: 'user', text: query });
    this.draft = '';
    this.loading = true;
    this.scrollToBottom();

    if (this.sessionId) {
      this.sessionStore.touchActiveSession(this.sessionId);
      this.sessionStore.upsertChat(this.sessionId, query);
      this.refreshChatList();
    }

    this.chatService.ask(query, this.sessionId).subscribe({
      next: (res) => {
        this.sessionId = res.sessionId;
        this.sessionStore.touchActiveSession(res.sessionId);
        this.sessionStore.upsertChat(res.sessionId, query);
        this.refreshChatList();
        this.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: res.answer,
          sources: res.sources,
          messageId: res.messageId,
          feedback: null,
        });
        this.loading = false;
        this.scrollToBottom();
      },
      error: () => {
        this.error = 'Something went wrong reaching the assistant. Please try again.';
        this.loading = false;
      },
    });
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected rate(message: ChatMessage, rating: FeedbackRating): void {
    if (!message.messageId || message.feedbackPending) {
      return;
    }

    message.feedbackPending = true;
    message.feedbackError = false;

    this.chatService.sendFeedback(message.messageId, rating).subscribe({
      next: () => {
        message.feedback = rating;
        message.feedbackPending = false;
      },
      error: () => {
        message.feedbackPending = false;
        message.feedbackError = true;
      },
    });
  }

  protected toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  protected openChat(sessionId: string): void {
    if (this.loading || this.historyLoading) {
      return;
    }
    this.loadSession(sessionId);
  }

  protected startNewChat(): void {
    this.sessionStore.clearActiveSession();
    this.sessionId = undefined;
    this.messages = [];
    this.error = null;
    this.draft = '';
  }

  protected relativeTime(timestamp: number): string {
    const diffMs = Date.now() - timestamp;
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) {
      return 'just now';
    }
    if (diffMs < hour) {
      return `${Math.floor(diffMs / minute)}m ago`;
    }
    if (diffMs < day) {
      return `${Math.floor(diffMs / hour)}h ago`;
    }
    return `${Math.floor(diffMs / day)}d ago`;
  }

  private loadSession(sessionId: string): void {
    this.historyLoading = true;
    this.error = null;

    this.chatService.getHistory(sessionId).subscribe({
      next: (history) => {
        this.sessionId = sessionId;
        this.sessionStore.touchActiveSession(sessionId);
        this.messages = history.map((item) => ({
          id: crypto.randomUUID(),
          role: item.role,
          text: item.content,
          sources: item.sources ?? undefined,
          messageId: item.id,
          feedback: null,
        }));
        this.historyLoading = false;
        this.scrollToBottom('auto');
      },
      error: () => {
        this.sessionStore.clearActiveSession();
        this.sessionId = undefined;
        this.messages = [];
        this.historyLoading = false;
      },
    });
  }

  private refreshChatList(): void {
    this.chatList = this.sessionStore.getChats().sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
    setTimeout(() => {
      const el = this.messagesEl?.nativeElement;
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior });
      }
    });
  }
}
