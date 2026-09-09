import { Injectable, TemplateRef, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface PageHeaderConfig {
  title: string;
  subtitle?: string | null;
  backUrl?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class PageHeaderService {
  private router = inject(Router);

  title = signal<string>('');
  subtitle = signal<string | null>(null);
  backUrl = signal<string | null>(null);
  actionsTemplate = signal<TemplateRef<any> | null>(null);

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationStart)
    ).subscribe(() => {
      this.clear();
    });
  }

  setHeader(config: PageHeaderConfig) {
    this.title.set(config.title);
    this.subtitle.set(config.subtitle ?? null);
    this.backUrl.set(config.backUrl ?? null);
  }

  setActions(template: TemplateRef<any> | null) {
    this.actionsTemplate.set(template);
  }

  clear() {
    this.title.set('');
    this.subtitle.set(null);
    this.backUrl.set(null);
    this.actionsTemplate.set(null);
  }
}
