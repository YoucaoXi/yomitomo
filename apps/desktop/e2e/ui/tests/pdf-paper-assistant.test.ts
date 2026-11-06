import { describe, expect, it } from 'vitest';
import {
  importRelationSource,
  openRelationSource,
  selectRelationQuote,
  withRelationDesktopApp,
  type RelationSource,
} from '../helpers/reading-relations-fixtures';
import { waitForLibraryDocument } from '../helpers/library';

const source: RelationSource = {
  kind: 'pdf',
  title: 'Paper assistant flow',
  quote: 'The method integrates gyroscope signals to estimate a heading.',
};

describe('PDF paper assistant', () => {
  it('analyses a PDF selection and keeps the saved response anchored after reopening', async () => {
    await withRelationDesktopApp(
      'pdf-paper-assistant',
      'https://e2e.invalid/yomitomo-ai',
      async ({ app, fixtureDir, page }) => {
        await importRelationSource(page, fixtureDir, source);
        await waitForLibraryDocument(page, source.title, 'PDF');
        await openRelationSource(page, source);

        const panel = page.getByRole('complementary', { name: 'Paper assistant' });
        await panel.getByRole('button', { name: 'Collapse paper assistant' }).click();
        await panel.waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: 'Open paper assistant' }).click();

        const divider = page.getByRole('separator', { name: 'Resize paper assistant' });
        const previousWidth = Number(await divider.getAttribute('aria-valuenow'));
        await divider.press('ArrowLeft');
        await expect
          .poll(async () => Number(await divider.getAttribute('aria-valuenow')))
          .toBeGreaterThan(previousWidth);

        await selectRelationQuote(page, source);
        const selectedQuote = await panel.locator('blockquote').innerText();
        expect(selectedQuote).toContain('The method integrates gyroscope signals');
        await panel.getByRole('radio', { name: 'Translate', exact: true }).click();
        expect(await panel.getByRole('button', { name: 'Translate selection' }).isEnabled()).toBe(
          true,
        );
        await panel.getByRole('radio', { name: 'Explain principles' }).click();
        expect(await panel.getByRole('button', { name: 'Explain step by step' }).isEnabled()).toBe(
          true,
        );
        await panel.getByRole('radio', { name: 'Read paper' }).click();

        await panel.getByLabel('Perspective').selectOption('practical');
        await panel.getByRole('button', { name: 'Break down method' }).click();
        const answer = panel.locator('.reader-chat-message.is-assistant');
        await answer.getByText('RD-795 fake AI response.', { exact: false }).first().waitFor();
        expect(await answer.textContent()).toContain('Use a practical perspective.');
        expect(await answer.textContent()).toContain(selectedQuote);
        await answer.getByRole('button', { name: 'Save to notes' }).click();
        await answer.getByRole('button', { name: 'Open saved note' }).waitFor();

        await page.getByRole('button', { name: 'Back to library' }).click();
        await openRelationSource(page, source);
        await panel.getByRole('button', { name: selectedQuote, exact: true }).click();
        await page.locator('.reader-highlight.is-active:not(.is-temporary)').first().waitFor();

        const discussionWindow = app.waitForEvent('window');
        await panel.getByRole('button', { name: 'Open discussion' }).click();
        const discussion = await discussionWindow;
        await discussion.getByText('RD-795 fake AI response.', { exact: false }).first().waitFor();
        await discussion.close();
      },
    );
  });
});
