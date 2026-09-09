import { Directive, OnDestroy, OnInit, TemplateRef, inject } from '@angular/core';
import { PageHeaderService } from '../../core/services/page-header.service';

@Directive({
  selector: '[appPageHeaderActions]',
  standalone: true
})
export class PageHeaderActionsDirective implements OnInit, OnDestroy {
  private headerService = inject(PageHeaderService);
  private templateRef = inject(TemplateRef<any>);

  ngOnInit() {
    this.headerService.setActions(this.templateRef);
  }

  ngOnDestroy() {
    this.headerService.setActions(null);
  }
}
