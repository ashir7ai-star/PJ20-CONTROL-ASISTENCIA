import axe from 'axe-core';

/**
 * Runs axe-core (WCAG 2.1 A/AA rules) on a rendered container and returns a
 * readable list of violations. Colour contrast is excluded here because jsdom
 * cannot compute styles; it is enforced from the tokens in design/tokens.test.ts.
 */
export async function a11yViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: {
      'color-contrast': { enabled: false },
      // Screens are tested in isolation, outside the full page landmarks.
      region: { enabled: false },
    },
  });
  return results.violations.map(
    (v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}
