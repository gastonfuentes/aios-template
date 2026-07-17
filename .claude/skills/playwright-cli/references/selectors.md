# Selectores — orden de preferencia

Playwright tiene varias formas de identificar elementos. La eleccion afecta cuantos tests se rompen al refactorizar.

## Orden canonico (mas robusto → mas fragil)

1. `getByRole` (basado en ARIA roles + accessible name).
2. `getByLabel` (asociado a `<input>` via `<label htmlFor>`).
3. `getByPlaceholder` (input placeholder text).
4. `getByText` (visible text content).
5. `getByTestId` (`data-testid="..."` explicito).
6. CSS selector (`page.locator('.btn-primary')`).
7. XPath (ultimo recurso, casi nunca).

## Por que role + label > CSS

Un test que usa `getByRole('button', { name: 'Continuar' })` sigue funcionando aunque cambies la clase, el wrapper, el tag (de `<button>` a `<a role="button">`). Mientras la accesibilidad este correcta, el test funciona.

`getByText` con regex tolera typos pequeños:

```ts
await page.getByRole('heading', { name: /bienvenid[oa]/i }).click();
```

## Cuando usar `data-testid`

Solo cuando los selectores anteriores no son posibles:

- Elementos sin texto visible y sin role (containers wrappers).
- Componentes generados dinamicamente sin label estable.

Convencion: `data-testid="<feature>-<element>"` (`signup-submit-btn`, `dashboard-revenue-card`).

## Anti-patron

```ts
// ❌ Fragil — si agregas un wrapper, rompe
await page.locator('div > div > button:nth-child(2)').click();

// ❌ Fragil — depende de class CSS auto-generada (ej. CSS modules con hash)
await page.locator('.Button_module__a8cQq').click();

// ✅ Robusto — sigue accessibility
await page.getByRole('button', { name: 'Confirmar pago' }).click();
```

## Locators encadenados

Para limitar a una seccion especifica:

```ts
const sidebar = page.getByRole('navigation', { name: 'Principal' });
await sidebar.getByRole('link', { name: 'Settings' }).click();
```

`sidebar` es un locator scoped. `getByRole` dentro de el solo busca en su descendencia. Util para evitar matches ambiguos cuando el mismo texto aparece varias veces.

## Auto-waiting

Playwright auto-espera que el elemento sea actionable antes de interactuar (visible, enabled, no animandose). NO necesitas `waitForSelector` explicito antes de cada click.

```ts
// ✅ Bien — auto-wait built-in
await page.getByRole('button', { name: 'Submit' }).click();

// ❌ Mal — redundante y fragil con timing
await page.waitForSelector('button:has-text("Submit")');
await page.click('button:has-text("Submit")');
```

## Asserts con auto-retry

```ts
await expect(page.getByText('Bienvenido')).toBeVisible();
```

`expect(...).toBeVisible()` reintenta hasta el timeout default (5s). No necesitas `await page.waitFor(...)` antes.
