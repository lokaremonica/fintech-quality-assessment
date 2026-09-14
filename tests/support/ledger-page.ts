import type { Page } from '@playwright/test';
import type { Actor, UserInput } from './contracts';

export class LedgerPage {
  constructor(readonly page: Page) {}

  async open(actor?: Actor) {
    if (actor) {
      await this.page.addInitScript(session => {
        sessionStorage.setItem('demo-session', JSON.stringify(session));
      }, { userId: actor.user.id, name: actor.user.name, token: actor.token });
    }
    await this.page.goto('/');
  }

  async register(user: UserInput) {
    await this.page.getByLabel('Full name').fill(user.name);
    await this.page.getByLabel('Email address').fill(user.email);
    await this.page.getByLabel('Account type').selectOption(user.accountType);
    await this.page.getByRole('button', { name: 'Create account' }).click();
  }

  async transfer(recipientId: string, amount: string) {
    await this.page.getByLabel('Recipient account ID').fill(recipientId);
    await this.page.getByLabel('Amount', { exact: true }).fill(amount);
    await this.page.getByRole('button', { name: 'Send transfer' }).click();
  }

  get registration() { return this.page.getByRole('region', { name: 'Create your account' }); }
  get transfers() { return this.page.getByRole('region', { name: 'Make a transfer' }); }
}
