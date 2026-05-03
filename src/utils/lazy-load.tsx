import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * A wrapper around React.lazy that reloads the page if a chunk fails to load.
 * This handles the "Failed to fetch dynamically imported module" error that occurs
 * when a new deployment happens and the user tries to navigate to a route with an old hash.
 */
export function lazyLoad<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(() => {
    return factory().catch((error) => {
      // Check if the error is related to dynamic import failure
      const isImportError = 
        error.message?.includes('Failed to fetch dynamically imported module') ||
        error.message?.includes('Importing a module script failed') ||
        error.name === 'ChunkLoadError';

      if (isImportError) {
        // Prevent infinite reload loops
        const storageKey = `lazy_reload_${window.location.pathname}`;
        const lastReload = sessionStorage.getItem(storageKey);
        const now = Date.now();

        // Reload if we haven't reloaded in the last 10 seconds
        if (!lastReload || now - parseInt(lastReload) > 10000) {
          sessionStorage.setItem(storageKey, now.toString());
          window.location.reload();
          // Return a never-resolving promise to wait for reload
          return new Promise(() => {});
        }
      }

      // If it's not an import error or we've already reloaded recently, rethrow
      throw error;
    });
  });
}
