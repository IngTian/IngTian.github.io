::::section[Checked]{#checked rail="Don't"}
A :cite[nobody1999] reference, a value :v[usd.nobody], and math that does not parse: $\frac{1$.

In maths, a value with no key, $:v[in.maths]$, and a citation, $:cite[nobody1999]$.

### A heading of its own

```text
a code block
```

:hl[A highlight with a :t[linked term]{#inner} inside it.]

:::def{for=ghost}
**Ghost.** Names a term that is not there.
:::

A paragraph with :t[risk parity]{#rp}, and :t[again]{#rp}.

Another paragraph, without the term.

:::def{for=rp}
**Risk parity.** Attached to the paragraph that does not hold its term.
:::

:::def
No name in bold.
:::

A :hlx[typo] directive and some <b>raw HTML</b>.

::figure{name=pipe}

:::figure{name=nothing n=3}
A caption for a drawing nobody registered.
:::

:::figure{name=pipe}
A caption, and no number.
:::

:::figure{name=pipe n=4}
:::
::::

:::section[Aside]{#aside aside="it's"}
A section whose aside needs curling.
:::

:::::section[Equations]{#eqs}
:::notation
| Symbol | Meaning |
| --- | --- |
| $Q_{t}$ | In no display, and not marked text-only. |
:::

::::eq{#eq-9 n=9}
$$ wide
x = 1 \tag{9}
$$
::::

:::where
A where outside an eq.
:::
:::::

:::section[Clash]{#eqs-title}
A section whose id is another section's heading's.
:::

:::section{#checked}
Untitled, and an id already used.
:::

:::section[Short]{#short}
:::def
**Inner.** Mis-nested: this fence closes the section too.
:::

Stray paragraph.
:::

:::why
Never closed.
