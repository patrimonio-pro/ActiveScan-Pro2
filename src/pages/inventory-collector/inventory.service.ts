import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { InventarioItem } from '../../shared/models/api.models';
import { SupabaseClient } from '@supabase/supabase-js';

const INVENTARIO_TABLE = 'inventario';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private supabase: SupabaseClient = inject(SupabaseService).client;
  private readonly storageKey = 'offline-inventory';

  // This signal holds the state of locally stored inventory items
  private localItems = signal<InventarioItem[]>([]);

  constructor() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      this.localItems.set(JSON.parse(stored));
    }
  }

  /**
   * Returns a readonly signal of the locally collected items.
   */
  getCollectedItems() {
    return this.localItems.asReadonly();
  }

  /**
   * Adds a new item to the local offline storage.
   */
  async saveItemLocally(item: Omit<InventarioItem, 'id' | 'is_synced'>) {
    const newItem: InventarioItem = {
      ...item,
      id: Date.now(), // Temporary local ID
      is_synced: false
    };
    this.localItems.update(items => [...items, newItem]);
    this.saveToLocalStorage();
    return newItem;
  }

  /**
   * Syncs unsynced items with the Supabase backend.
   */
  async syncWithBackend() {
    const unsyncedItems = this.localItems().filter(item => !item.is_synced);
    if (unsyncedItems.length === 0) {
      return { success: true, synced: 0 };
    }

    // Prepare items for insertion: remove temporary local `id` and `is_synced` flag.
    const itemsToInsert = unsyncedItems.map(({ id, is_synced, ...rest }) => rest);
    
    const { error } = await this.supabase.from(INVENTARIO_TABLE).insert(itemsToInsert);

    if (error) {
      console.error('Error syncing items to Supabase:', error.message, error);
      throw error;
    }

    // On success, mark all local items as synced.
    this.localItems.update(currentItems => 
      currentItems.map(item => ({ ...item, is_synced: true }))
    );
    this.saveToLocalStorage();
    
    return { success: true, synced: unsyncedItems.length };
  }

  /**
   * Tries to get real geolocation, with a mock fallback.
   */
  getCurrentPosition(): Promise<{ lat: number, lon: number }> {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
              (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
              (error) => {
                  console.warn('Geolocation failed, falling back to mock.', error.message);
                  // Fallback to mock on error (e.g., user denies permission)
                  resolve({ lat: -23.5505, lon: -46.6333 });
              }
          );
      } else {
          console.log('Geolocation not supported, using mock.');
          // Fallback to mock if API is not available
          setTimeout(() => {
              resolve({ lat: -23.5505, lon: -46.6333 });
          }, 800);
      }
    });
  }

  private saveToLocalStorage() {
     localStorage.setItem(this.storageKey, JSON.stringify(this.localItems()));
  }
}
