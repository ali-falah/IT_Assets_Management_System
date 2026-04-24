import { Component, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Store } from '@ngrx/store';
import { Observable, Subscription, map } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthState } from '../store/auth/auth.reducer';
import * as AuthActions from '../store/auth/auth.actions';
import { User } from '../services/user.service';
import { SearchService, SearchResult } from '../services/search.service';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, LucideAngularModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit, OnDestroy {
  private store = inject(Store<{ auth: AuthState }>);
  private router = inject(Router);
  private searchService = inject(SearchService);
  private routerSubscription?: Subscription;
  private searchSubscription?: Subscription;

  isCollapsed = false;
  isProfileMenuOpen = false;
  isCommandPaletteOpen = false;
  
  searchTerms = new Subject<string>();
  searchResults: SearchResult = { assets: [], users: [] };
  isSearching = false;

  user$: Observable<User | null> = this.store.select(state => state.auth.user);
  userInitials$: Observable<string> = this.user$.pipe(
    map(user => {
      if (!user?.name) return '?';
      return user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
    })
  );

  isAdmin = false;

  ngOnInit() {
    this.store.select(state => state.auth.user).subscribe((user: any) => {
      this.isAdmin = user?.role === 'admin' || user?.role?.name === 'admin';
    });

    this.searchSubscription = this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(term => {
        if (!term || term.length < 2) {
          return of({ assets: [], users: [] });
        }
        this.isSearching = true;
        return this.searchService.search(term);
      })
    ).subscribe(results => {
      this.searchResults = results;
      this.isSearching = false;
    });

    // Close menus on navigation
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isProfileMenuOpen = false;
      this.isCommandPaletteOpen = false;
    });

    this.checkScreenSize();
  }

  ngOnDestroy() {
    this.routerSubscription?.unsubscribe();
    this.searchSubscription?.unsubscribe();
  }

  private checkScreenSize() {
    if (window.innerWidth < 1024) {
      this.isCollapsed = true;
    } else {
      this.isCollapsed = false;
    }
  }

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleProfileMenu(event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  logout() {
    this.store.dispatch(AuthActions.logout());
  }

  openCommandPalette() {
    this.isCommandPaletteOpen = true;
    this.searchResults = { assets: [], users: [] };
  }

  closeCommandPalette() {
    this.isCommandPaletteOpen = false;
  }

  onSearchInput(event: Event) {
    const term = (event.target as HTMLInputElement).value;
    this.searchTerms.next(term);
  }

  navigateToResult(type: string, id: string) {
    this.closeCommandPalette();
    if (type === 'asset') {
      this.router.navigate(['/assets', id, 'edit']);
    } else if (type === 'user') {
      this.router.navigate(['/users'], { queryParams: { userId: id } });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-menu-container')) {
      this.isProfileMenuOpen = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.openCommandPalette();
    } else if (event.key === 'Escape' && this.isCommandPaletteOpen) {
      this.closeCommandPalette();
    }
  }
}
