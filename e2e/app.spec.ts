import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('录入链路', () => {
  test('非法行就地标错并阻止计算，修正后放行', async ({ page }) => {
    const input = page.getByTestId('assertions-input');
    await input.fill('0 甲港 乙港 3');
    await expect(page.getByTestId('line-error-1')).toContainText('编号');
    await expect(page.getByTestId('line-error-1')).toContainText('0 甲港 乙港 3');
    await expect(page.getByTestId('blocked-hint')).toBeVisible();
    await expect(page.getByTestId('compute')).toBeDisabled();

    await input.fill('1 甲港 乙港 3');
    await expect(page.getByTestId('ok-summary')).toContainText('1 条断言，2 个事件');
    await expect(page.getByTestId('compute')).toBeEnabled();
  });

  test('编号重复在重复行就地标错', async ({ page }) => {
    await page.getByTestId('assertions-input').fill('1 A B 1\n2 B C 2\n1 C A 3');
    await expect(page.getByTestId('line-error-3')).toContainText('重复');
    await expect(page.getByTestId('line-error-3')).toContainText('第 1 行');
    await expect(page.getByTestId('compute')).toBeDisabled();
  });

  test('c 越界与字段缺失均阻止计算', async ({ page }) => {
    await page.getByTestId('assertions-input').fill('1 A B 100001\n2 B C');
    await expect(page.getByTestId('line-error-1')).toContainText('超出范围');
    await expect(page.getByTestId('line-error-2')).toContainText('4 个字段');
    await expect(page.getByTestId('compute')).toBeDisabled();
  });
});

test.describe('求证链路', () => {
  test('矛盾批次：按环序展示不等式、累计和与总和小于零结论', async ({ page }) => {
    await page.getByTestId('sample-contradiction').click();
    await page.getByTestId('compute').click();

    const table = page.getByTestId('witness-table');
    await expect(table).toBeVisible();
    await expect(page.getByTestId('witness-ids')).toHaveText('[1, 2, 3]');
    await expect(page.getByTestId('witness-events')).toHaveText('甲港 → 乙港 → 丙港 → 甲港');

    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('#1');
    await expect(rows.nth(0)).toContainText('date(乙港) - date(甲港) ≤ 5');
    await expect(rows.nth(1)).toContainText('date(丙港) - date(乙港) ≤ -8');
    await expect(rows.nth(2)).toContainText('date(甲港) - date(丙港) ≤ 1');
    // 累计和：5, -3, -2
    await expect(rows.nth(0).locator('td').last()).toHaveText('5');
    await expect(rows.nth(1).locator('td').last()).toHaveText('-3');
    await expect(rows.nth(2).locator('td').last()).toHaveText('-2');
    await expect(table.locator('tfoot')).toContainText('-2');

    const conclusion = page.getByTestId('conclusion');
    await expect(conclusion).toContainText('总和小于零');
    await expect(conclusion).toContainText('矛盾');
  });

  test('相容批次：只显示约束相容，不编造日期', async ({ page }) => {
    await page.getByTestId('sample-consistent').click();
    await page.getByTestId('compute').click();
    await expect(page.getByTestId('consistent')).toContainText('约束相容');
    await expect(page.getByTestId('witness-table')).toHaveCount(0);
    // 不出现任何具体日期指派
    await expect(page.getByTestId('result')).not.toContainText('年');
    await expect(page.getByTestId('result')).not.toContainText('=');
  });

  test('多环批次：按编号整数序列字典序取最小且可复现', async ({ page }) => {
    await page.getByTestId('sample-multi').click();
    await page.getByTestId('compute').click();
    await expect(page.getByTestId('witness-ids')).toHaveText('[2, 4, 7]');
    await expect(page.getByTestId('witness-events')).toHaveText('丙港 → 甲港 → 丁港 → 丙港');
    // 重复计算结果稳定
    await page.getByTestId('compute').click();
    await expect(page.getByTestId('witness-ids')).toHaveText('[2, 4, 7]');
  });

  test('负自环：单条断言构成最短矛盾链', async ({ page }) => {
    await page.getByTestId('assertions-input').fill('7 补给 补给 -3');
    await page.getByTestId('compute').click();
    await expect(page.getByTestId('witness-ids')).toHaveText('[7]');
    await expect(page.getByTestId('witness-events')).toHaveText('补给 → 补给');
    await expect(page.getByTestId('conclusion')).toContainText('总和小于零');
  });

  test('输入修改后提示结果过期', async ({ page }) => {
    await page.getByTestId('sample-contradiction').click();
    await page.getByTestId('compute').click();
    await expect(page.getByTestId('witness')).toBeVisible();
    await page.getByTestId('assertions-input').fill('1 甲港 乙港 5');
    await expect(page.getByTestId('stale-hint')).toBeVisible();
  });
});
