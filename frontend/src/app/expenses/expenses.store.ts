import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  Balances,
  Bill,
  BillInput,
  Expense,
  ExpenseInput,
  IsoDate,
  Member,
  PayBillInput,
  Settlement,
  SettlementInput,
} from '@hogar/shared';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../core/errors';
import { HouseholdsService } from '../core/households.service';

/** Gastos, pagos entre personas, saldos y facturas de la casa activa. */
@Injectable({ providedIn: 'root' })
export class ExpensesStore {
  private readonly http = inject(HttpClient);
  private readonly households = inject(HouseholdsService);
  private householdId: string | null = null;

  readonly members = signal<Member[]>([]);
  readonly balances = signal<Balances | null>(null);
  readonly bills = signal<Bill[]>([]);
  readonly error = signal<string | null>(null);

  private get api() {
    return `/api/households/${this.householdId}`;
  }

  /** Miembros, saldos y facturas (lo que no depende del mes). */
  async load(householdId: string): Promise<void> {
    this.householdId = householdId;
    try {
      const [household, balances, bills] = await Promise.all([
        this.households.get(householdId),
        firstValueFrom(this.http.get<Balances>(`${this.api}/expenses/balances`)),
        firstValueFrom(this.http.get<Bill[]>(`${this.api}/bills`)),
      ]);
      if (this.householdId !== householdId) return;
      this.members.set(household.members);
      this.balances.set(balances);
      this.bills.set(bills);
      this.error.set(null);
    } catch (err) {
      if (this.householdId === householdId) this.error.set(errorMessage(err, 'No se pudieron cargar los gastos.'));
    }
  }

  async refreshBalances(): Promise<void> {
    this.balances.set(await firstValueFrom(this.http.get<Balances>(`${this.api}/expenses/balances`)));
  }

  expenses(from: IsoDate, to: IsoDate): Promise<Expense[]> {
    return firstValueFrom(this.http.get<Expense[]>(`${this.api}/expenses`, { params: { from, to } }));
  }

  settlements(from: IsoDate, to: IsoDate): Promise<Settlement[]> {
    return firstValueFrom(this.http.get<Settlement[]>(`${this.api}/settlements`, { params: { from, to } }));
  }

  async saveExpense(id: string | null, input: ExpenseInput): Promise<Expense> {
    const expense = await firstValueFrom(
      id ? this.http.patch<Expense>(`${this.api}/expenses/${id}`, input) : this.http.post<Expense>(`${this.api}/expenses`, input),
    );
    await this.refreshBalances();
    return expense;
  }

  async removeExpense(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/expenses/${id}`));
    await this.refreshBalances();
  }

  async settle(input: SettlementInput): Promise<Settlement> {
    const settlement = await firstValueFrom(this.http.post<Settlement>(`${this.api}/settlements`, input));
    await this.refreshBalances();
    return settlement;
  }

  async removeSettlement(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/settlements/${id}`));
    await this.refreshBalances();
  }

  async saveBill(id: string | null, input: Partial<BillInput>): Promise<void> {
    const bill = await firstValueFrom(
      id ? this.http.patch<Bill>(`${this.api}/bills/${id}`, input) : this.http.post<Bill>(`${this.api}/bills`, input),
    );
    this.bills.update((list) => sortBills([...list.filter((b) => b.id !== bill.id), bill]));
  }

  async removeBill(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/bills/${id}`));
    this.bills.update((list) => list.filter((b) => b.id !== id));
  }

  async payBill(id: string, input: PayBillInput): Promise<Expense> {
    const { bill, expense } = await firstValueFrom(
      this.http.post<{ bill: Bill; expense: Expense }>(`${this.api}/bills/${id}/pay`, input),
    );
    this.bills.update((list) => sortBills(list.map((b) => (b.id === id ? bill : b))));
    await this.refreshBalances();
    return expense;
  }
}

/** Activas primero y por vencimiento, como las devuelve la API. */
function sortBills(list: Bill[]): Bill[] {
  return list.sort((a, b) => Number(b.active) - Number(a.active) || a.nextDue.localeCompare(b.nextDue));
}
