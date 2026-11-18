import { test, expect } from '@playwright/test';

test('keeps the existing navigation when quizzes are disabled', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Quizzes' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Go to BQ Search lookup/ })).toBeVisible();
});
