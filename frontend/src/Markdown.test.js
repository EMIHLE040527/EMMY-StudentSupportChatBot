import { render, screen } from '@testing-library/react';
import Markdown from './Markdown';

test('renders bold, italic and inline code without their markers', () => {
  const { container } = render(<Markdown text="Try **spaced** _repetition_ with `anki`." />);
  expect(screen.getByText('spaced').tagName).toBe('STRONG');
  expect(screen.getByText('repetition').tagName).toBe('EM');
  expect(screen.getByText('anki').tagName).toBe('CODE');
  expect(container.textContent).not.toMatch(/[*_`]/);
});

test('renders bullet and numbered lists', () => {
  const { container } = render(
    <Markdown text={'Steps:\n\n- read it\n- recall it\n\n1. plan\n2. write'} />
  );
  expect(container.querySelectorAll('ul > li')).toHaveLength(2);
  expect(container.querySelectorAll('ol > li')).toHaveLength(2);
  expect(screen.getByText('recall it')).toBeInTheDocument();
});

test('nests a sub-list inside its parent item', () => {
  const { container } = render(
    <Markdown text={'- exam week\n    - monday\n    - tuesday\n- essay'} />
  );
  expect(container.querySelectorAll(':scope > .prose > ul > li')).toHaveLength(2);
  expect(container.querySelectorAll('li ul > li')).toHaveLength(2);
});

test('renders headings and fenced code', () => {
  const { container } = render(
    <Markdown text={'### Setup\n\n```python\nprint("hi")\n```'} />
  );
  expect(screen.getByRole('heading', { name: 'Setup' })).toBeInTheDocument();
  expect(container.querySelector('pre code').textContent).toBe('print("hi")');
  expect(screen.getByText('python')).toBeInTheDocument();
});

test('links out safely and drops unsafe hrefs', () => {
  render(<Markdown text="See [notes](https://example.com) and [bad](javascript:alert(1))" />);
  const link = screen.getByRole('link', { name: 'notes' });
  expect(link).toHaveAttribute('href', 'https://example.com');
  expect(link).toHaveAttribute('rel', 'noreferrer');
  expect(screen.queryByRole('link', { name: 'bad' })).not.toBeInTheDocument();
  expect(screen.getByText(/bad/)).toBeInTheDocument();
});

test('typesets inline maths and keeps subscripts out of the italic rule', () => {
  const { container } = render(<Markdown text="If $a_1 + b_2 = c$ then solve for $x$." />);
  expect(container.querySelectorAll('.math-inline .katex')).toHaveLength(2);
  expect(container.querySelector('em')).toBeNull();
  expect(container.textContent).not.toMatch(/\$/);
});

test('typesets a display equation as its own block', () => {
  const { container } = render(
    <Markdown text={'The formula:\n\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nUse it.'} />
  );
  expect(container.querySelectorAll('.prose > .math-display')).toHaveLength(1);
  expect(container.querySelector('.math-display .katex-display')).toBeInTheDocument();
  expect(container.querySelectorAll('.prose > p')).toHaveLength(2);
  // Real typeset fraction and radical, not literal LaTeX. (The source itself
  // survives in KaTeX's MathML annotation, which is what makes it copyable.)
  expect(container.querySelector('.math-display .mfrac')).toBeInTheDocument();
  expect(container.querySelector('.math-display .sqrt')).toBeInTheDocument();
  expect(container.querySelector('.math-display annotation')).toHaveTextContent('\\frac');
});

test('reads a display equation spread over several lines', () => {
  const { container } = render(<Markdown text={'$$\nf(x) = x^2\n$$'} />);
  expect(container.querySelectorAll('.math-display')).toHaveLength(1);
});

test('handles display maths indented inside a list item', () => {
  const { container } = render(
    <Markdown text={'1. Plug in the numbers:\n   $$x = \\frac{-4}{2}$$\n2. Simplify.'} />
  );
  expect(container.querySelectorAll('ol > li')).toHaveLength(2);
  expect(container.querySelectorAll('li .math-display')).toHaveLength(1);
});

test('typesets maths nested inside bold and italic', () => {
  // Verbatim shapes emmy produced in a live reply.
  const { container } = render(
    <Markdown text={'1. **Identify $a$, $b$, $c$**:\n\nSo the solutions are **$x = 1$ and $x = -3$**.'} />
  );
  expect(container.querySelectorAll('strong .katex').length).toBeGreaterThanOrEqual(4);
  expect(container.textContent).not.toMatch(/\$/);
});

test('renders inline code nested inside bold', () => {
  const { container } = render(<Markdown text="Run **`npm start`** first." />);
  expect(container.querySelector('strong code')).toHaveTextContent('npm start');
  expect(container.textContent).not.toMatch(/`/);
});

test('leaves currency alone', () => {
  const { container } = render(<Markdown text="The book costs $5 and the set costs $40." />);
  expect(container.querySelector('.katex')).toBeNull();
  expect(container.textContent).toBe('The book costs $5 and the set costs $40.');
});

test('falls back to the LaTeX source when a formula will not parse', () => {
  const { container } = render(<Markdown text="Broken: $\\frac{1}{$" />);
  expect(container.querySelector('.katex')).toBeNull();
  expect(container.textContent).toContain('\\frac{1}{');
});

test('renders plain prose as a paragraph', () => {
  const { container } = render(<Markdown text="Hi Demo! I'm emmy, your study buddy." />);
  expect(container.querySelectorAll('p')).toHaveLength(1);
  expect(screen.getByText(/study buddy/)).toBeInTheDocument();
});
