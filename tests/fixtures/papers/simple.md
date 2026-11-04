::::section[In brief]{#brief}
A paper about :t[risk parity]{#rp}, in brief.

:::def{for=rp}
**Risk parity.** Every holding carries the same share of the risk (:cite[maillard2008]).
:::

:hl[One dollar grew to :v[usd.rl].] The rest is detail.
::::

::::section[Notation]{#notation}
:::notation
| Symbol | Meaning |
| --- | --- |
| $W_{g}$ | The weight of sector $g$. |
| $\mathrm{RC}_{g}(w),\ G$ | Sector $g$'s risk, one of $G$. |
| $\theta$ {text-only} | The policy's parameters. |
:::
::::

:::::section[The method]{#method n=1 rail="Method"}
Each sector gets a weight:

::::eq{#eq-1 n=1}
$$ wide
W_{g} = \sum_{i \in g} w_{i} + W + \mathrm{RC}_{g}(w)
$$

$$ narrow
W_{g} = \sum_{i} w_{i} + W + \mathrm{RC}_{g}(w)
$$

:::where
where $W_{g}$ is the :t[sector weight]{#sw}.
:::

:::def{for=sw}
**Sector weight.** The share of the money in a sector.
:::

:::why
It keeps the weights adding up to one.
:::
::::

::figure{name=pipe}

```text
code is not read
```
:::::
