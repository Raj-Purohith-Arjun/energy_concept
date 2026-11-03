import type { RefusalCategory } from "@/lib/schemas";
import type { GateMutation } from "./mutation";
import { variants } from "./normalize";

// Deterministic refusal gate (CLAUDE.md §6 Phase B step 4, §9). No model is
// involved. If ANY rule matches ANY normalised variant of the question, the
// whole question is refused. Ambiguity resolves to refusal: a wrongful refusal
// is cheap, a wrongful answer is the one outcome this project can't have.

export interface PrefilterHit {
  category: RefusalCategory;
  trigger: string;
}

type Rule = {
  category: PrefilterHit["category"];
  test: (text: string, now: Date) => string | null;
};

const re = (category: PrefilterHit["category"], pattern: RegExp): Rule => ({
  category,
  test: (text) => pattern.exec(text)?.[0] ?? null,
});

// Both must match; reports the first pattern's text as the trigger.
const both = (category: PrefilterHit["category"], a: RegExp, b: RegExp): Rule => ({
  category,
  test: (text) => (b.test(text) ? (a.exec(text)?.[0] ?? null) : null),
});

const INVESTMENT_WORD = /\b(?:invest\w*|stocks?|shares?|equity|portfolio|returns?|money|buy\w*|bets?)\b/;

// Naming one of these in a question to this assistant is a comparison.
const ALT_ASSETS =
  /\b(?:bitcoin|btc|crypto\w*|ethereum|dogecoin|s ?& ?p(?: ?500)?|s and p|sp ?500|etfs?|tesla (?:stock|shares)|tsla|nvidia (?:stock|shares)|nvda|albemarle|sqm|arcadium|livent|lithium americas|standard lithium|piedmont lithium|vulcan energy|ganfeng|tianqi)\b/;

// Ambiguous words ("gold standard", "chemical bonds") count only with
// comparison wording or an investment word.
const AMBIGUOUS_ASSETS = /\b(?:gold|real estate|bonds?|treasur(?:y|ies)|savings accounts?|index funds?|property)\b/;
const COMPARE_WORDS =
  /\b(?:better|worse|safer|riskier|smarter|stronger|weaker) (?:than|investment|bet|buy|pick)\b|\bcompar\w*\b|\bversus\b|\bvs\b\.?|\binstead of\b|\brather than\b|\bor should i\b/;

// Rules run in this order; the first hit decides the category shown.
const RULES: Rule[] = [
  // --- Investment advice -------------------------------------------------
  re("advice", /\bshould (?:i|we|my|me|someone|people|one|you|investors?)\b.{0,40}?\b(?:invest|buy|sell|hold|put|get in|back|bet|purchase|allocate)\w*/),
  re("advice", /\b(?:is|are|was) (?:it|energyx|this|that|they|the company|the stock|the shares)(?: \w+)? (?:a |an )?(?:good|great|smart|wise|bad|sound|solid|terrible|decent) (?:investment|buy|bet|idea|time|opportunity|pick|play)\b/),
  re("advice", /\b(?:good|right|best) (?:time|moment) to (?:buy|invest|get in)\b/),
  re("advice", /\b(?:a )?(?:good|great|smart|solid) (?:investment|buy|bet)\b/),
  re("advice", /\bworth (?:investing|buying|it|the risk|a punt)\b/),
  re("advice", /\brecommend\w*|\badvice\b|\badvise (?:me|us)\b|\b(?:financial|investment) advis\w*/),
  re("advice", /\bbuy,? (?:or )?(?:sell|hold)\b|\bbuy or not\b/),
  re("advice", /\b(?:how much|what amount) (?:should|to|do|would|could)\b.{0,20}?\b(?:invest|put in|put into|allocate|buy)\b/),
  re("advice", /\b(?:my|our) (?:savings|retirement|401 ?k|ira|pension|portfolio|nest egg|college fund|life savings)\b/),
  re("advice", /\bwould you (?:invest|buy|put)\b|\bdo you (?:think|believe|reckon)\b.{0,60}?\b(?:invest|buy|good|worth)\w*/),
  re("advice", /\b(?:i want|i'?d like|i'?m (?:thinking|planning|looking|going)|i plan|i intend) (?:of |about )?(?:to )?(?:invest|buy|put)\w*/),
  re("offering", /\bbuy (?:energyx |some |more |the )?(?:shares|stock|equity)\b/),
  re("advice", /\binvestment (?:advice|opportunity|thesis|case|potential)\b|\bbullish\b|\bbearish\b|\bpros and cons\b/),

  // --- Guarantees and risk -----------------------------------------------
  re("guarantees", /\bguarant\w*|\brisk[- ]?free\b|\b(?:no|zero|without) risk\b|\bcan'?t lose\b|\bcan ?not lose\b/),
  re("guarantees", /\bsafe (?:investment|bet|place|haven|to invest|buy)\b|\bis energyx (?:a )?safe\b|\b(?:is|are) (?:my money|investing|my investment|the shares|the stock) safe\b/),
  re("guarantees", /\bsure (?:thing|bet)\b|\b(?:money|investment|capital|principal|savings) (?:is |be |stay )?(?:protected|insured)\b|\bfdic\b|\bdownside\b|\brisky\b|\briskiest\b|\bhow risky\b/),
  re("guarantees", /\blose (?:my|all|any|the|our|your) (?:money|investment|savings)\b/),

  // --- Returns -------------------------------------------------------------
  re("returns", /\breturns\b|\breturn on\b|\bwhat (?:kind of |sort of )?return\b|\b(?:my|a|good|high|expected|annual|total|likely) return\b|\broi\b|\byields?\b|\bdividends?\b|\bpayouts?\b/),
  re("returns", /\bprofit\w* (?:from|on|off)\b|\b(?:i|we|you|investors?|shareholders?) (?:\w+ )?profit\b|\bmake (?:a )?profit\b|\b(?:capital|investment|financial|big|huge|my|your|our) gains?\b|\bupside\b/),
  // "appreciate" only with an investment word nearby ("thanks, I appreciate it" is fine).
  re("returns", /\bappreciat\w* in value\b|\b(?:shares?|stock|price|value|investment|equity)\b(?: \w+){0,3} appreciat\w*|\bappreciat\w*(?: \w+){0,3} \b(?:shares?|stock|price|investment|equity)\b/),
  re("returns", /\bgo(?:es|ing)? up\b|\bto the moon\b|\bmoon\w*\b|\bskyrocket\w*|\bshoot up\b|\b\d+ ?x\b|\b(?:ten|hundred|thousand)x\b|\b\w*bagger\b/),
  re("returns", /\bdouble (?:my|your|our|the) money\b|\bmultiply (?:my|your|our) money\b|\bmake (?:me |us )?(?:money|rich|a fortune)\b|\bget(?:ting)? rich\b/),
  re("returns", /\bhow much (?:would|will|could|can|might|do) (?:i|we|you|investors?) (?:make|earn|get|have|gain|receive)\b|\bworth (?:more|a lot|millions|billions)\b|\bwhat (?:would|will|could) .{0,40}?\bbe worth\b/),
  re("returns", /[\u{1F680}\u{1F4C8}\u{1F4B0}\u{1F4B8}\u{1F911}\u{1F4B5}\u{1F4B2}]/u),

  // --- Valuation -----------------------------------------------------------
  re("valuation", /\bvaluations?\b|\bvalued at\b|\b(?:company|energyx|share|stock|equity)(?:'s)? (?:value|worth)\b|\bvalue of (?:the )?(?:company|energyx|shares?|stock|equity|my)\b/),
  re("valuation", /\bmarket (?:cap|capitali[sz]ation|value)\b|\b(?:share|stock|unit) prices?\b|\bprice (?:per|of a|of the|of each) (?:share|stock|unit)\b|\bprice target\b/),
  re("valuation", /\bwhat (?:is|'s) energyx worth\b|\bhow much (?:is|are) (?:a |one |each |the )?(?:shares?|stocks?|units?|energyx|the company) (?:worth|cost|selling)\b|\benterprise value\b|\b(?:pre|post)[- ]?money\b|\bp ?\/ ?e\b|\bunicorn\b/),

  // --- Comparisons with other investments ----------------------------------
  re("comparison", ALT_ASSETS),
  both("comparison", AMBIGUOUS_ASSETS, new RegExp(`${COMPARE_WORDS.source}|${INVESTMENT_WORD.source}`)),
  both("comparison", COMPARE_WORDS, INVESTMENT_WORD),

  // --- Buying shares / offering terms --------------------------------------
  re("offering", /\b(?:how|where|when) (?:do|can|could|would|should|might) (?:i|we|you|someone|one|people) (?:invest|buy|purchase)\b|\bhow to (?:invest|buy|purchase)\b|\bget (?:some )?(?:shares|stock|equity)\b|\bget in on\b/),
  re("offering", /\b(?:i|we|you|can|could|would|might) invest in\b|\binvesting in energyx\b|\bbuy into\b/),
  re("offering", /\bminimum (?:investment|amount|purchase|buy[- ]?in|check)\b|\baccredited\b|\breg(?:ulation)? ?(?:a\+?|cf)(?!\w)|\bregulation crowdfunding\b|\bcrowdfund\w*|\boffering circular\b|\bofferings?\b|\bsubscription agreement\b|\bbonus shares\b|\bshare class(?:es)?\b|\b(?:share|equity|stock|ownership|shareholder) dilution\b|\bdilut\w* (?:my|our|the|existing) (?:shares|stake|ownership|equity|shareholders)\b|\bcap table\b/),

  // --- IPO and listing ------------------------------------------------------
  re("ipo", /\bipos?\b|\binitial public offering\b|\b(?:go|goes|going|gone|went) public\b|\bpublic (?:listing|offering|markets?)\b|\bpublicly (?:traded|listed)\b/),
  re("ipo", /\blist(?:ed|ing|s)? (?:on|in) (?:the )?(?:nasdaq|nyse|stock (?:exchange|market)|tsx|lse|asx|an? exchange)\b|\bnasdaq\b|\bnyse\b|\bstock (?:exchange|market)\b|\bticker\b|\bspac\b|\bdirect listing\b|\breverse merger\b|\buplist\w*/),
  re("ipo", /\bexit (?:strategy|event|plan)\b|\bliquidity event\b/),
  // Acquisitions only with future/conditional or investor framing, so "Did GM
  // acquire a stake?" (past, published) is answerable.
  both(
    "ipo",
    /\bacquir\w*|\bacquisition\b|\bbuy ?out\b|\bbought out\b|\btake ?over\b|\bmerger\b/,
    /\b(?:will|would|could|might|may|going to|gonna|plans?|planning|potential\w*|possibl\w*|likely|rumou?r\w*|talks|considering|expected|future|someday|ever|soon)\b|\b(?:my|our) (?:shares|stock|investment|stake)\b|\bshareholders? (?:get|receive|be paid)\b|\bpremium\b|\bpayout\b/,
  ),

  // --- Future timing --------------------------------------------------------
  re("future-timing", /\b(?:will|shall|gonna|going to|won'?t)\b(?! (?:you|u|ya)\b)/),
  re("future-timing", /\bwhen(?:'s| is| are| will| does| do| should| can| could| might)\b|\bwhat (?:year|date|month|quarter) (?:will|is|does|do|are)\b|\bhow (?:long|soon) (?:until|till|til|before|will)\b/),
  // "planned", "target" and "plans for" are absent on purpose: asking for a plan
  // EnergyX has published is answered (chipped and footnoted), not refused.
  re("future-timing", /\b(?:expect\w*|anticipat\w*|projected|projections?|projects? to|forecast\w*|outlook|guidance|roadmap|timeline|eta|upcoming|soon|eventually|future|someday|some day|predict\w*|prognos\w*|speculat\w*|likely to|likelihood|probability|odds)\b/),
  re("future-timing", /\bnext (?:year|quarter|month|week|decade|phase|round|step|stage|milestone)\b|\bfrom now\b|\b(?:years?|months?) from\b|\bcoming (?:years?|months?|quarters?)\b|\bin (?:a|one|two|three|four|five|six|seven|eight|nine|ten|\d+|a few|few|several|some|the coming) (?:years?|months?|decades?|quarters?)\b/),
  re("future-timing", /\bby (?:the )?(?:end of )?(?:(?:19|20)\d{2}|next|this year)\b/),
  re("future-timing", /\b(?:start|begin|commence|first|commercial|full)\w* (?:production|operations?|output)\b|\bcome online\b|\bgo(?:es|ing)? live\b|\bbe(?:come)? operational\b|\bbe completed\b|\bbreak\w* ground\b|\bfirst lithium\b|\bramp\w* up\b/),
  {
    // Any year from the current one onwards ("in 2027", "the 2030 plan").
    category: "future-timing",
    test: (text, now) => {
      for (const m of text.matchAll(/\b(?:19|20)\d{2}\b/g)) {
        if (Number(m[0]) >= now.getUTCFullYear()) return m[0];
      }
      return null;
    },
  },

  // --- Multilingual backstop (high-risk terms only; diacritics are stripped) --
  re("ipo", /\b(?:a|en) bolsa\b|\bbolsa de valores\b|\bintroduction en bourse\b|\bborsengang\b|\bcotizar\b/),
  re("returns", /\brentabilidad\b|\brendimiento\b|\brendement\b|\brendite\b|\bdividendos\b|\bdividende\b|\bganancias\b/),
  re("advice", /\binvertir\b|\binversion\b|\binvestir\b|\binvestieren\b|\bacciones\b|\bacoes\b|\baktien?\b/),
];

/** First matching rule across all normalised variants, or null. */
export function prefilter(question: string, now: Date, mutation: GateMutation = {}): PrefilterHit | null {
  if (mutation.prefilterOff) return null;
  const texts = mutation.normaliseOff ? [question.toLowerCase()] : variants(question);
  for (const rule of RULES) {
    if (mutation.categoriesOff?.includes(rule.category)) continue;
    for (const text of texts) {
      const trigger = rule.test(text, now);
      if (trigger !== null) return { category: rule.category, trigger };
    }
  }
  return null;
}
