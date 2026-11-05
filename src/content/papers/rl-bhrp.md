---
publication: rl-bhrp
pageDate: 2026-11-03
leftOut: the weight figures (the paper’s Figs. 2–3)
bibliographyOmits:
  - a work by Ninsin listed with no venue or year
references:
  - key: markowitz1952
    authors: ['Markowitz, Harry']
    year: 1952
    title: Portfolio selection
    journal: The Journal of Finance
    venue: '7(1): 77–91'
    doi: 10.1111/j.1540-6261.1952.tb01525.x
    addedHere: §1
  - key: maillard2008
    authors: ['Maillard, Sébastien', 'Roncalli, Thierry', 'Teïletche, Jérôme']
    year: 2008
    title: On the properties of equally-weighted risk contributions portfolios
    venue: SSRN
  - key: lopezdeprado2016
    authors: ['López de Prado, Marcos']
    year: 2016
    title: Building diversified portfolios that outperform out-of-sample
    journal: Journal of Portfolio Management
  - key: feng2022
    authors: ['Feng, Guanhao', 'He, Jingyu']
    year: 2022
    title: 'Factor investing: a Bayesian hierarchical approach'
    journal: Journal of Econometrics
    venue: '230(1): 183–200'
  - key: cooper2020
    authors: ['Cooper, Ricky', 'Molyboga, Marat', 'Molyboga, Georgiy']
    year: 2020
    title: 'Black-Litterman, exotic beta, and varying efficient portfolios: an integrated approach'
    venue: SSRN
  - key: millea2022
    authors: ['Millea, Adrian', 'Edalat, Abbas']
    year: 2022
    title: Using deep reinforcement learning with hierarchical risk parity for portfolio optimization
    journal: International Journal of Financial Studies
    venue: '11(1): 10'
  - key: ledoit2004
    authors: ['Ledoit, Olivier', 'Wolf, Michael']
    year: 2004
    title: A well-conditioned estimator for large-dimensional covariance matrices
    journal: Journal of Multivariate Analysis
    venue: '88(2): 365–411'
    doi: 10.1016/S0047-259X(03)00096-4
    addedHere: Alg. 3
  - key: schulman2017
    authors: ['Schulman, John', 'Wolski, Filip', 'Dhariwal, Prafulla', 'Radford, Alec', 'Klimov, Oleg']
    year: 2017
    title: Proximal policy optimization algorithms
    venue: arXiv:1707.06347
    url: https://arxiv.org/abs/1707.06347
    addedHere: Alg. 4
errata:
  - date: 2026-11-03
    text: '§4.1 gives the test window as “Feb - 2020 to Aug - 2020”; it is :v[startMonth] to :v[endMonth].'
  - date: 2026-11-03
    text: 'The caption of Figure 3 reads “EL-BHRP” for RL-BHRP.'
  - date: 2026-11-03
    text: '§6 quotes BHRP’s CAGR as 13.37%, where its Table 2 gives :v[tableCagr.bhrp], that is :v[cagr.bhrp]%.'
  - date: 2026-11-03
    text: '§3.2.2 refers to the two-level weights as “Definition ??”, an unresolved reference.'
  - date: 2026-11-03
    text: 'Def. 3.2.3 centres the within-sector penalty over all :v[universe] stocks, while Alg. 1’s stopping test measures that dispersion within each sector; with sectors of different sizes the two disagree (see “A catch in the definition”, under eq. (4)).'
---

::::section[In brief]{#brief}
**The problem.** Choosing a portfolio from forecasts of returns is fragile, because the forecasts are noisy, while :t[risk parity]{#rp}, which gives every holding the same share of the risk, is steadier but ignores expected returns altogether.

:::def{for=rp}
**Risk parity.** Weights chosen so that every holding contributes the same share of the portfolio’s total risk (:cite[maillard2008]). It needs no forecast of returns, only of how they vary and move together.
:::

**The idea.** RL-BHRP lets a learned policy decide each month how much goes to each of :v[sectors] sectors and to each stock inside them, rewarding the month’s return after trading costs and charging for risk shares that stray from equal among stocks and among sectors.

**What happened.** On one test — :v[universe] large US stocks, :v[startMonth] to :v[endMonth], a period kept out of the model’s design — \$1 grew to :v[usd.rl], against :v[usd.bhrp] for BHRP (Bayesian hierarchical risk parity, the paper’s static model) and :v[usd.bench] for an equal-weight mix of :v[sectors] sector funds.

**The catch.** The edge over BHRP, about :v[gapPP] percentage points a year, came with more volatility and, by the paper’s count, a deeper worst fall, rests on one path through one market, and has not been tested against chance.
::::

:::section[Abstract]{#abstract aside="in the paper’s own words"}
::abstract

Three phrases in it need the table beside them (Table 1 below, which is the paper’s Table 2). The “comparable” drawdown is RL-BHRP’s fall of :v[mdd.rl]%, the deepest of the three by the paper’s count. The “more stable” performance swung more than BHRP’s and about as much as the benchmark’s. And the paper runs no test that would support “adds value” (paper §5.5).
:::

::::section[Notation]{#notation}
The page keeps the paper’s symbols and defines each where it first appears; this table is for looking back. Equation numbers are the paper’s, and its (1), the sectors’ covariance matrix, is in the note beside (2).

:::notation
| Symbol | Meaning |
| --- | --- |
| $N,\ G$ | The number of stocks and of sectors: :v[universe] and :v[sectors] in the test. |
| $i\in\mathcal{I}_{g}$ | Stock $i$, one of the stocks in sector $g$. $g(i)$ is the sector stock $i$ belongs to. |
| $w,\ w_{i}$ | The portfolio: $w_{i}$ is the fraction of the money in stock $i$. Weights are never negative and add up to 1 (long-only and fully invested). |
| $W_{g}$ | Sector weight: the fraction of the money in sector $g$. |
| $\eta_{i\mid g},\ \eta^{(g)}$ | Within-sector weight: the fraction of sector $g$'s money that goes to stock $i$. $\eta^{(g)}$ is sector $g$'s whole set of them. |
| $R_{t+1}$ | The stocks’ returns over month $t+1$. |
| $\widehat{\mu}_{i}$ {text-only} | The Bayesian layer’s estimate of stock $i$'s average return, pulled toward its sector’s. |
| $\Sigma,\ \Sigma_{t}$ | The $N\times N$ covariance matrix of returns: variances on the diagonal, co-movements off it. $\Sigma_{t}$ is the estimate made at month-end $t$; $\Sigma_{gh}$ is the block of $\Sigma$ for the stocks of sectors $g$ and $h$. |
| $\widetilde{\Sigma}(\eta)$ | The $G\times G$ covariance matrix of the sectors, each sector held at its inside weights $\eta$. |
| $\sigma_{p}^{2}(w)$ | The variance of the portfolio’s return, $w^{\top}\Sigma w$: the measure of risk that everything here balances. |
| $\mathrm{RC}_{i}(w),\ \mathrm{RC}_{g}(w)$ | The risk contribution of stock $i$, and of sector $g$: its share of $\sigma_{p}^{2}$. |
| $c$ | Trading cost per unit of turnover: :v[costBps] basis points, or :v[costPct]% of every dollar traded, in the test. |
| $\mathcal{V}_{\mathrm{within}},\ \mathcal{V}_{\mathrm{across}}$ | How unequal the risk contributions are: $\mathcal{V}_{\mathrm{within}}$ across all :v[universe] stocks (as the paper defines it, not within each sector), $\mathcal{V}_{\mathrm{across}}$ among the :v[sectors] sectors. Each is zero when its contributions are equal; with sectors of different sizes the two cannot both be zero (see the note after (4)). |
| $\lambda,\ \alpha$ | How heavily the reward charges for unequal risk, and how that charge is split between the two terms. The paper does not report either value. |
| $U_{t+1}$ | The reward for month $t+1$: the return, less costs, less the charge for unequal risk. |
| $\theta$ {text-only} | The policy’s parameters, which PPO adjusts. |
:::
::::

::::section[The question]{#question n=1 rail="Question"}
How should money be divided among stocks when the one input everyone wants — how much each will return — is the one nobody can estimate well?

The textbook answer is :t[mean–variance allocation]{#mv} (:cite[markowitz1952]): choose the weights with the best trade-off between expected return and risk. In its simplest form the solution multiplies the expected returns by the inverse of the :t[covariance matrix]{#cov}, which magnifies small errors in either and pushes the weights to extremes, an effect sometimes called “error maximization” (paper §1).

:::def{for=mv}
**Mean–variance allocation.** The weights with the most expected return for a given variance. It trusts the estimated means completely.
:::

:::def{for=cov}
**Covariance matrix.** For every pair of stocks, how much their returns move together; the diagonal holds each one’s variance. Diversification works only as far as holdings do not move together.
:::

Risk-based methods leave the forecasts out. Risk parity (:cite[maillard2008]) chooses weights so that each holding contributes the same share of risk, which needs only the covariance matrix. :t[Hierarchical risk parity]{#hrp} (:cite[lopezdeprado2016]) splits risk down a tree, between groups and then within them, and so never inverts the full matrix. Bayesian hierarchical models let a stock with little data lean on its sector’s average (:cite[feng2022]), and risk parity has been used as the starting allocation that a Bayesian model then revises with an investor’s views (:cite[cooper2020]).

:::def{for=hrp}
**Hierarchical risk parity (HRP).** Risk parity down a tree, so no step inverts the full covariance matrix. HRP finds its tree by clustering; BHRP uses the :v[sectors] sectors of GICS, the standard industry classification.
:::

What these leave out is any view of returns: risk parity treats expected returns as noise, which, the paper argues, leaves performance on the table when markets shift (paper §2). :t[Reinforcement-learning]{#rl} allocators do respond to markets, but without explicit risk budgets — a target share of risk for each holding, which risk parity sets equal — they tend to concentrate and trade heavily. An earlier combination puts a learning agent over hierarchical risk parity, but only lets it switch between twelve precomputed portfolios and cash (:cite[millea2022]).

:::def{for=rl}
**Reinforcement learning.** Learning a decision rule — a policy — by trial: act, receive a reward, and shift the rule toward actions that earned more. Here an action is a month’s portfolio, and the reward is eq. (4) below.
:::

The paper combines the pieces. Its static model, BHRP, applies risk parity at two levels — equal risk across the :v[sectors] sectors, and equal risk among the stocks inside each — using a shrunk estimate of the covariance matrix. RL-BHRP replaces that fixed rule with a policy that chooses both levels of weights every month and is charged for trading costs and for unequal risk. The policy is, in effect, a view on returns; the charge for unequal risk is what is meant to keep it from drifting to mean–variance’s extreme weights. The question is whether that freedom adds return while the charge keeps the risk from bunching up in a few stocks or sectors.
::::

::::::section[Method]{#method n=2}
RL-BHRP has three layers: estimate, balance, and learn. Each month-end a Bayesian layer turns past returns into estimates; risk parity, applied to stocks and to sectors, defines what balanced risk means; and a policy chooses the actual weights. :hl[The policy may choose any weights, but every month it pays for letting risk drift away from equal shares.]

:::figure{name=pipeline n=1}
How the pieces connect each month. The policy sees the Bayesian layer’s estimates (dashed) and chooses the weights; the reward scores the month’s return and charges for costs and for unequal risk, computed from $\Sigma$; PPO uses the reward to update the policy’s parameters $\theta$. BHRP solves its own two-level equal-risk condition from the same $\Sigma$ and is the comparator in the results. In the paper’s specification (§3.2.2) the policy’s state does not include BHRP’s weights; the paper does not say whether the policy starts from them, and the reproduction’s policy (Figure 2) starts exactly at them and adjusts from there. Source: drawn for this page from the paper’s Alg. 4 and Def. 3.2.3.
:::

**Estimates.** At each month-end the Bayesian layer does two things. It estimates each stock’s average return and pulls it toward its sector’s average, harder when the stock’s own history is erratic — :t[Bayesian shrinkage]{#bs}, under a three-level normal model of returns (market, sector, stock) in which how far each level may stray from the one above is fixed in advance (paper Defs. 3.1.3–3.1.6, §5.2). And it estimates the covariance matrix $\Sigma$ with :t[Ledoit–Wolf shrinkage]{#lw} (:cite[ledoit2004]).

:::def{for=bs}
**Bayesian shrinkage.** Blending a noisy individual estimate with a steadier group estimate, each weighted by how far it can be trusted.
:::

:::def{for=lw}
**Ledoit–Wolf shrinkage.** With dozens of stocks and a few years of data, the sample covariance matrix is noisy. Ledoit and Wolf blend it with a simple structured matrix, in the proportion that minimises the expected error.
:::

**Two levels of weights.** A portfolio is described by its weights: the fraction of the money in each stock, never negative, adding up to one. RL-BHRP writes each stock’s weight as two choices multiplied together — how much goes to its sector, and how much of the sector’s money goes to that stock:

::::eq{#eq-wmap}
$$
w_{i}\;=\;W_{g(i)}\,\eta_{i\mid g(i)}
$$

:::where
where $W_{g(i)}$ is the share of the money in stock $i$'s sector and $\eta_{i\mid g(i)}$ is the share of that sector’s money in stock $i$.
:::

:::why
This split is what lets risk be budgeted at two levels: across sectors through $W$, within each through $\eta$. It loses nothing — every long-only, fully invested portfolio with no zero weights has exactly one such split (Prop. 3.1.8).
:::
::::

**Risk contributions.** Risk here means the variance of the portfolio’s return, $\sigma_{p}^{2}(w)=w^{\top}\Sigma w$. To balance it, the paper needs to say how much of it each stock is responsible for:

::::eq{#eq-rc}
$$
\mathrm{RC}_{i}(w)=w_{i}(\Sigma w)_{i}
$$

:::where
where $(\Sigma w)_{i}$, the $i$-th entry of $\Sigma w$, is the covariance of stock $i$'s return with the portfolio’s, and $\mathrm{RC}_{i}$ is the stock’s risk contribution (Def. 3.1.10). A sector’s contribution $\mathrm{RC}_{g}$ is the sum over its stocks.
:::

:::why
It turns “risk” into something each stock owns a piece of. A stock carries risk in proportion to how much of it is held and how much it moves with everything else held; a stock that moves against the rest can carry very little.
:::
::::

The contributions add up exactly to the portfolio’s variance (a lemma in the paper’s §3.1.10):

::::eq{#eq-lemma}
$$
\sum_{i=1}^{N}\mathrm{RC}_{i}(w)=\sigma_{p}^{2}(w)
$$

:::where
That identity is what makes “equal risk” a precise target. Flat risk parity asks each of the $N$ stocks to carry $1/N$ of the variance; BHRP asks each of the :v[sectors] sectors to carry an equal share, and each stock within a sector an equal part of its sector’s.
:::

:::why
Because the contributions sum to $\sigma_{p}^{2}$, their average is $\sigma_{p}^{2}/N$; the charge $\mathcal{V}_{\mathrm{within}}$ in (4) below is their mean squared distance from it.
:::
::::

:::::thm{#thm-3-1-11}
**Theorem 3.1.11** *(two-level variance and sector risk decomposition).* In words first:

Fix how each sector divides its money among its own stocks. Then each sector behaves like a single asset — a fund made of its stocks — and the portfolio’s variance, and each sector’s risk contribution, are exactly those of an ordinary :v[sectors]-asset portfolio of these funds. :hl[So once each sector’s inside weights are fixed, balancing risk across sectors is ordinary risk parity on :v[sectors] assets.]

In symbols, with $w$ the final weights built from $W$ and $\eta$ as above,

::::eq{#eq-2 n=2}
$$
\sigma_{p}^{2}(w)\;=\;W^{\top}\widetilde{\Sigma}(\eta)\,W
$$

:::def
**$\widetilde{\Sigma}(\eta)$.** The $G\times G$ covariance matrix of the sectors’ returns, each sector held at its inside weights: entry $(g,h)$ is $(\eta^{(g)})^{\top}\Sigma_{gh}\,\eta^{(h)}$, where $\Sigma_{gh}$ is the block of $\Sigma$ for sectors $g$ and $h$ and $\eta^{(g)}$ is sector $g$'s inside weights. It is the paper’s eq. (1), in Def. 3.1.9.
:::
::::

and, for each sector $g$,

::::eq{#eq-3 n=3}
$$
\mathrm{RC}_{g}(w)\;=\;W_{g}\,\bigl(\widetilde{\Sigma}(\eta)\,W\bigr)_{g}
$$

:::where
where $\widetilde{\Sigma}(\eta)$ is the sectors’ covariance matrix and $(\widetilde{\Sigma}W)_{g}$ the $g$-th entry of $\widetilde{\Sigma}W$. Equation (3) has the same form as a single asset’s risk contribution in a $G$-asset portfolio, and that is the paper’s corollary to the theorem: equal sector risk is flat risk parity on $\widetilde{\Sigma}(\eta)$. The proof is two lines of block-matrix algebra.
:::

:::why
The sector step becomes ordinary risk parity on :v[sectors] assets, so standard solvers, and what is known about flat risk parity, carry over; the paper’s Appendix A uses a Newton method.
:::
::::
:::::

**BHRP.** A fixed rule, applied at each month-end to the latest $\Sigma$: the portfolio at which both conditions hold at once — equal risk across sectors, and equal risk among the stocks inside each. The paper finds it by alternating the two steps until neither moves (Alg. 1–2), and it is the comparator in the results. Despite the name, its weights use only $\Sigma$, which the paper calls the posterior covariance but computes by Ledoit–Wolf, so the Bayesian means reach only the policy.

**The learning layer.** Each month the policy sees recent returns, the Bayesian estimates and its own previous weights, and chooses $W$ and $\eta$. After the month it is scored:

::::eq{#eq-4 n=4}
$$ wide
\begin{aligned}U_{t+1}(w_{t})&=w_{t}^{\top}R_{t+1}\;-\;c\,\|w_{t}-w_{t-1}\|_{1}\\&\quad-\;\lambda\Bigl[\alpha\,\mathcal{V}_{\mathrm{within}}(w_{t};\Sigma_{t})+(1{-}\alpha)\,\mathcal{V}_{\mathrm{across}}(w_{t};\Sigma_{t})\Bigr]\end{aligned}
$$

$$ narrow
\begin{aligned}U_{t+1}(w_{t})&=w_{t}^{\top}R_{t+1}\;-\;c\,\|w_{t}-w_{t-1}\|_{1}\\&\quad-\;\lambda\Bigl[\alpha\,\mathcal{V}_{\mathrm{within}}(w_{t};\Sigma_{t})\\&\qquad+(1{-}\alpha)\,\mathcal{V}_{\mathrm{across}}(w_{t};\Sigma_{t})\Bigr]\end{aligned}
$$

:::where
where $w_{t}^{\top}R_{t+1}$ is the portfolio’s return over the month; $c\,\|w_{t}-w_{t-1}\|_{1}$ is the trading cost, $c$ per unit of :t[turnover]{#to}; and the bracket measures how unequal the risk contributions are — $\mathcal{V}_{\mathrm{within}}$ across all :v[universe] stocks, $\mathcal{V}_{\mathrm{across}}$ among the :v[sectors] sectors, both computed from $\Sigma_{t}$, the covariance estimate at month-end $t$, and each zero exactly when its contributions are equal (Def. 3.2.3) — weighted by $\lambda$, with $\alpha$ splitting the charge between the two.
:::

:::def{for=to}
**Turnover.** The month’s buys and sells added up, as a fraction of the portfolio: $\|w_{t}-w_{t-1}\|_{1}$. A basis point (bp) is 0.01%, so at :v[costBps] bps, trading :v[turnoverPct]% of the portfolio costs :v[costPctMonth]%.
:::

:::why
Risk parity is not imposed; it is priced. A larger $\lambda$ makes uneven risk more expensive, but no value of it makes risk equal at both levels at once (below). The paper reports neither $\lambda$ nor $\alpha$.
:::
::::

**A catch in the definition.** As written (Def. 3.2.3), $\mathcal{V}_{\mathrm{within}}$ compares each stock with the average over all :v[universe] stocks, not over its own sector as the paper’s Alg. 1 does. With sectors of :v[sectorMin] to :v[sectorMax] stocks the two terms cannot both be zero: equal risk per stock gives the :v[itStocks] technology stocks :v[itShareStocks]% of the risk, equal risk per sector gives them :v[itShareSectors]%. So the charge pulls toward a compromise that $\alpha$ sets, not toward BHRP, and BHRP itself would be charged. The reproduction tried both readings; for its main policy design the results barely differ (average growth of :v[reproCagrGlobal]% and :v[reproCagrSector]% a year).

The policy outputs a score for each sector and for each stock within it, and a softmax turns each set of scores into weights, so whatever it outputs is a valid portfolio (paper §3.2.4). It is trained by :t[proximal policy optimization]{#ppo} (PPO; :cite[schulman2017]) on :v[trainFrom]–:v[trainTo] data and is not retrained during the test (Alg. 4, paper §5.4). That is at most :v[decisions] monthly decisions to learn from (fewer if the first years go to the estimates’ rolling window), replayed in every training iteration; the paper gives no network size, iteration count or number of training runs.

:::def{for=ppo}
**PPO.** A standard way to train a policy: nudge it toward actions that earned more reward than expected, with each update clipped so the policy cannot change too much at once.
:::

:::inpaper
**In the paper:** the Bayesian update is Alg. 3; the sectors’ covariance is Def. 3.1.9, eq. (1); the within-sector equal-risk condition follows Theorem 3.1.11; the two penalty terms are Def. 3.2.3; the softmax policy and its feasibility are §3.2.4–3.2.5; training is Alg. 4.
:::
::::::

:::::section[Results]{#results n=3}
The test asks what would have happened to money run by each rule over the :v[years] years the model never saw.

:hl[\$1 invested at the start of :v[startMonth] grew to :v[usd.rl] under RL-BHRP by mid-:v[endMonth], against :v[usd.bhrp] under BHRP and :v[usd.bench] under the benchmark.] BHRP is the paper’s static two-level risk parity; the benchmark is a simple, investable yardstick — equal amounts in the :v[sectors] SPDR sector ETFs, exchange-traded funds that each hold one sector. It is not the whole market: it gives every sector the same money whatever the sector’s size, and the paper makes no comparison with the market as a whole. The test is one :t[out-of-sample]{#oos} path of :v[months] monthly returns on :v[universe] large US stocks across :v[sectors] sectors, rebalanced at each month-end, through a window that takes in the 2020 crash and the 2022 sell-off. RL-BHRP pays :v[costBps] basis points on every dollar it trades; the benchmark pays no trading costs, and the paper does not say what BHRP pays.

:::why
BHRP is the paper’s static version of the same two-level risk parity, so the gap to BHRP is the closest the paper comes to measuring what the learning added. It is not a clean measurement: only the policy sees the return estimates, and its charge aims at a different balance from BHRP’s (see “A catch in the definition”). The paper runs no ablation to separate these (paper §5.7).
:::

:::def{for=oos}
**Out-of-sample.** Data kept back while the model was designed and tuned, and used only to test it. The paper designs on :v[trainFrom]–:v[trainTo] and tests on :v[startYear]–:v[endYear].
:::

As a steady yearly rate — the :t[compound annual growth rate]{#cagr}, or CAGR — that is :v[cagr.rl]% for RL-BHRP, :v[cagr.bhrp]% for BHRP and :v[cagr.bench]% for the benchmark. RL-BHRP’s edge over BHRP is about :v[gapPP] percentage points a year, and over the benchmark about :v[gapPP.bench].

:::def{for=cagr}
**CAGR.** The constant yearly rate that turns \$1 into the final amount: $:v[wealth.rl]^{12/:v[months]}-1$ = :v[cagr.rl]% for RL-BHRP.
:::

:::figure{name=wealth n=2}
**A reproduction, not the paper’s run:** growth of \$1, :v[startMonth] to :v[endMonth] (the last month is partial). The paper’s own curve is its Figure 1 (paper §4.1); it does not release the monthly series, so this figure redraws the second author’s reproduction instead. The red line is the month-by-month median of the reproduction’s :v[reproRuns] training runs and the band their range: they ended between :v[reproLo] and :v[reproHi], where the paper reports :v[usd.rl] from its original run. It rebuilds BHRP and the benchmark to match the paper’s, and the direction of RL-BHRP’s gain, with a policy that starts at BHRP and trades about a quarter as much as the paper’s (the run with the median growth turns over :v[reproTurnover] of the portfolio a month, against :v[turnover]); the red line ends at :v[reproEnd], an edge over BHRP of about :v[reproGap] percentage points a year rather than :v[gapPP]. Some of its settings were chosen after the test period had been seen, so it is not fresh evidence. Source: [IngTian/rl-bhrp](https://github.com/IngTian/rl-bhrp), `results/shared-global`.
:::

:hl[Against BHRP, the extra return came with extra risk.] RL-BHRP was more :t[volatile]{#vol} than BHRP — :v[vol.rl]% a year against :v[vol.bhrp]% — and about as volatile as the benchmark, at :v[vol.bench]%. By the paper’s count it also had the deepest :t[maximum drawdown]{#mdd}, a fall of :v[mdd.rl]% from its peak, against :v[mdd.bhrp]% for BHRP and :v[mdd.bench]% for the benchmark. Those falls are measured from the first month-end, so they leave out :v[startMonth], the first month of the COVID crash. Counted from the start, in the reproduction’s matching series, BHRP’s deepens to :v[mdd0.bhrp]% and the benchmark’s to :v[mdd0.bench]%; RL-BHRP’s own cannot be recounted, because the paper does not release its monthly series, so for the paper’s run the order on that count is not known. The reproduction is the one place all three are counted from the start, and there the median of its runs (Figure 2’s red line) falls :v[mdd0.rl]%, less than BHRP’s, though the runs range from :v[mdd0.runsLo]% to :v[mdd0.runsHi]%, either side of it. Per unit of risk RL-BHRP still comes out ahead, by margins the paper does not test: its :t[Sharpe ratio]{#sr} is :v[sharpe.rl], against :v[sharpe.bhrp] and :v[sharpe.bench], and its growth per unit of worst fall (the Calmar ratio) is the highest, :v[calmar.rl]. Table 1 gives every row of the paper’s Table 2.

:::def{for=vol}
**Volatility.** The standard deviation of monthly returns, scaled to a year. The usual one-number measure of how much a portfolio swings.
:::

:::def{for=mdd}
**Maximum drawdown.** The largest fall from a previous peak to a later low, here on month-end values. It answers “how bad did it get?”
:::

:::def{for=sr}
**Sharpe ratio.** Average return divided by volatility, both annual: return per unit of risk. Over :v[years] years one Sharpe ratio is uncertain by about ±:v[sharpeSE] (one standard error); gaps between portfolios this alike are less uncertain than that, but the paper tests none. Table 1 subtracts no risk-free rate (the return on cash, such as Treasury bills); subtracting it would lower all three.
:::

::::figure{name=metrics n=1}
Full-period metrics, out of sample: the paper’s Table 2, every row.

Source: Table 2 of arXiv\:2508.11856v1, rounded to two decimals. :v[months] monthly periods, :v[start] to :v[end]; the last month is partial (daily data end :v[dataEndIso]); annualised over 12 periods. The benchmark is an equal-weight portfolio of the :v[sectors] SPDR sector ETFs, rebalanced monthly. Costs: RL-BHRP pays :v[costBps] bps one-way on turnover; the benchmark pays no trading costs; the paper does not state BHRP’s cost basis. Conventions, which the paper does not state and the reproduction recovered from the benchmark column: rf = 0; population standard deviations; drawdown measured from the first month-end, so :v[startMonth]’s loss is not counted; Sortino’s denominator is std(min(*r*, 0)).

:sup[a] Undefined: the benchmark’s tracking error against itself is zero. The paper prints NaN.

:::def
**Reading Table 1.** *Tracking error*: the volatility of the gap between the portfolio’s monthly return and the benchmark’s. *Information ratio*: the average gap divided by the tracking error, that is, how steadily the portfolio beats the benchmark. *Sortino*: like Sharpe, but dividing by downside volatility only. *Calmar*: CAGR divided by the size of the maximum drawdown. *Beta*: how much the portfolio moves with the benchmark; :v[beta.rl] is almost one for one. *Jensen alpha*: return beyond what that beta explains. *VaR 5%*: the monthly return that one month in twenty fell below; *CVaR 5%*: the average of those worst months. *Hit rate*: the share of months with a gain.
:::
::::

**Is it luck?** All of this is one path through one market. :hl[Neither gap has been shown to be more than chance.] Against the benchmark, RL-BHRP’s information ratio of :v[ir.rl] over :v[years] years corresponds to a *t*-statistic of about :v[tstat], short of the 1.96 a conventional test at the 5% level asks for. The gap to BHRP cannot be tested from the paper’s table at all, because a test needs the two monthly return series side by side, and the paper runs no formal test of either difference (paper §5.5).

:::why
With roughly independent months, *t* ≈ information ratio × √years = :v[ir.rl] × √:v[years] ≈ :v[tstat]. Over :v[years] years, a real edge of this size is hard to tell from luck.
:::

**Costs.** In the paper’s run RL-BHRP trades a good deal: its turnover averaged :v[turnover] a month, buys and sells together worth :v[turnoverPct]% of the portfolio (95th percentile :v[turnoverP95]; paper §4.2). At :v[costBps] bps per dollar traded that is about :v[costBpsMonth] bps a month, roughly :v[costPPYear] percentage points a year, already in its :v[cagr.rl]%, since its returns carry the cost model (paper §4.1). BHRP trades far less — :v[reproTurnoverBhrp] a month in the reproduction — so whether or not it pays costs moves its return by about :v[reproCostPPYearBhrp] points a year.

**Concentration.** The 15 names with the largest average weight held about half the money (:v[top15.mean] on average, range :v[top15.lo]–:v[top15.hi]; paper §4.2). For scale, any 15 of the :v[universe] at equal weights would hold :v[top15Equal]%, and in the reproduction BHRP’s own top 15 hold :v[reproTop15Bhrp]%.

**Balance.** Neither the paper nor this page measures how close to equal the risk contributions stayed, so the second half of the question — whether the charge kept the risk from bunching up — is not answered here.
:::::

::::section[What it implies, and where it stops]{#limits n=4 rail="Limits"}
The paper offers a design and one test of it.

The design’s point is that learning need not replace a risk model. The policy is free to choose any weights, but the charge in (4) prices its departures from a target risk managers already understand, equal shares of risk — which the paper offers as an answer to the usual complaint that reinforcement learning in finance is a black box (paper §6). And Theorem 3.1.11 turns each sector step into an ordinary :v[sectors]-asset risk-parity problem, so standard solvers and intuition carry over, though the paper does not prove that alternating the two steps has a solution, that the solution is unique, or that the steps converge (paper §5.6).

Whether the learning reliably adds return is a separate question, and one path cannot settle it. Most of the limits below are the paper’s own (paper §5); where one is this page’s reading, it says so.

- **The stocks.** The paper notes that Yahoo Finance, its price source, can omit delisted companies (paper §5.1). Separately, and this is this page’s reading rather than the paper’s: the paper’s :v[universe] names, listed in its sector map, are one fixed list, all still listed and large in :v[endYear], and the paper does not say when they were chosen. It holds that its screen, set in advance each quarter, avoids look-ahead (paper §4, §6), but a fixed list can still leave out firms that failed along the way. Both are forms of :t[survivorship bias]{#sb}. :hl[The benchmark is the only one of the three not drawn from that list, so the gap to it is the number most exposed.] A policy that follows returns may also lean into the list’s later winners more than BHRP does.

  :::def{for=sb}
  **Survivorship bias.** Testing only on companies that are still around. The failures are missing from the sample, so results look better than they would have in real time.
  :::

- **One split.** One training period, :v[trainFrom]–:v[trainTo], and one test period, :v[startYear]–:v[endYear], with no repeated tests over other windows (paper §5.5).

- **Costs.** A flat :v[costBps] bps per dollar traded: no allowance for the price moving against a large trade and no test at higher costs (paper §5.3, §5.5), against a benchmark that pays nothing (paper §4.1).

- **The model of returns.** Returns are modelled as normally distributed, though real returns have fat tails and volatility that comes in clusters, and how far each level of the model may stray from the one above is set by hand rather than learned (paper §5.2).

- **The learning.** PPO is sensitive to how the reward is scaled and tuned, and it maximises expected return rather than guarding against losses (paper §5.4); it learns from at most :v[decisions] monthly decisions; the charge for unequal risk encourages equal contributions without guaranteeing them (paper §5.3), and neither the paper nor this page measures how close they came; and the policy is not retrained after :v[trainTo] (paper §5.4).

- **Unreported settings.** The paper gives no values for $\lambda$, $\alpha$, the policy network or the number of training iterations, and the original run’s training seed has been lost (the second author’s note, in the reproduction), so the paper’s RL-BHRP column cannot be re-run exactly.

- **Proofs and tests.** No statistical test of the performance differences (paper §5.5), and, as above, no proof about the two-level balancing procedure (paper §5.6).

- **The last month.** The data end on :v[dataEnd], so the final month is partial, which slightly perturbs the annual figures (paper §5.1).

**What comes next** (paper §5.7): repeat the test on survivorship-free, point-in-time data and wider universes; compare monthly, weekly and daily rebalancing with realistic trading costs; build fat-tailed, time-varying risk models into the hierarchy and pair them with learning objectives that care about losses; turn the balancing step into a layer the policy can be trained through, instead of a penalty; and release reproducible code with ablations and formal statistical tests.
::::
