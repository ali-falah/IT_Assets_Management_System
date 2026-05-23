import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { LucideAngularModule } from 'lucide-angular';
import { Observable, Subject, Subscription, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { filter } from 'rxjs/operators';
import { OfflineManagerService } from '../services/offline-manager.service';
import { PlatformService } from '../services/platform.service';
import { SearchResult, SearchService } from '../services/search.service';
import { User } from '../services/user.service';
import * as AuthActions from '../store/auth/auth.actions';
import { AuthState } from '../store/auth/auth.reducer';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, LucideAngularModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent implements OnInit, OnDestroy {
  private store = inject(Store<{ auth: AuthState }>);
  private router = inject(Router);
  private searchService = inject(SearchService);
  private offlineManager = inject(OfflineManagerService);
  private platform = inject(PlatformService);
  private routerSubscription?: Subscription;
  private searchSubscription?: Subscription;

  isCollapsed = false;
  isProfileMenuOpen = false;
  isCommandPaletteOpen = false;
  isMobile = this.platform.isMobile;

  // Offline / queue state
  isOnline$: Observable<boolean> = this.offlineManager.getOnlineStatus();
  queueCount$: Observable<number> = this.offlineManager.queueCount$;
  lastSyncedAt: Date | null = null;
  showOfflineBanner = false;
  private onlineSubscription?: Subscription;
  
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

    // Track online/offline for banner
    const ts = this.offlineManager.getLastSyncedAt();
    this.lastSyncedAt = ts ? new Date(ts) : null;
    this.onlineSubscription = this.isOnline$.subscribe(online => {
      this.showOfflineBanner = !online;
      if (online) {
        // Refresh last sync time after coming back online
        setTimeout(() => {
          const newTs = this.offlineManager.getLastSyncedAt();
          this.lastSyncedAt = newTs ? new Date(newTs) : null;
        }, 3000);
      }
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
    this.onlineSubscription?.unsubscribe();
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
