# Translation review

> Every Arabic string in this codebase is either:
>
> 1. Reviewed by a native Arabic speaker (and recorded here as **reviewed**), or
> 2. Marked in code with `TODO(translate)` and listed in the **Pending review**
>    table below.
>
> The senior project report at `Senior-BlueCare-FinalReport.docx` does **not**
> contain extractable Arabic strings (image-only interface designs). We're
> authoring Arabic copy from first principles using Modern Standard Arabic
> with culturally appropriate vocabulary; a native reviewer must approve
> before launch.

## Pending review

| Key                                           | English                                                                                              | Current Arabic                                                                  | Notes                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `common.appName`                              | BlueCare                                                                                             | بلوكير                                                                          | Transliteration of brand. Confirm preferred form.                                |
| `common.tagline`                              | Smart, personalized communication for children with autism                                           | تواصل ذكي وشخصي للأطفال ذوي اضطراب طيف التوحد                                   | Confirm "اضطراب طيف التوحد" vs. "التوحد" only — clinical communities differ.     |
| `common.languageSwitcher.label`               | Language                                                                                             | اللغة                                                                           | OK.                                                                              |
| `common.themeSwitcher.highContrast`           | High contrast                                                                                        | تباين عالٍ                                                                      | Confirm.                                                                         |
| `common.error.title`                          | Something went wrong                                                                                 | حدث خطأ ما                                                                      | OK.                                                                              |
| `common.notFound.title`                       | Page not found                                                                                       | الصفحة غير موجودة                                                               | OK.                                                                              |
| `nav.forCaregivers`                           | For caregivers                                                                                       | لمقدّمي الرعاية                                                                 | Could also be "لأولياء الأمور" — confirm intent (parents-only vs. broader).      |
| `nav.forTherapists`                           | For therapists                                                                                       | للمعالجين                                                                       | Confirm: "أخصائيو النطق واللغة"?                                                 |
| `marketing.landing.hero.eyebrow`              | Built with autism specialists                                                                        | صُمم بمشاركة مختصين في طيف التوحد                                               | OK.                                                                              |
| `marketing.landing.hero.title`                | Every child has something to say.                                                                    | لكل طفل ما يقوله.                                                               | Period in Arabic — confirm style guide.                                          |
| `marketing.landing.hero.subtitle`             | (long)                                                                                               | (long)                                                                          | Confirm vocabulary "غير الناطقين أو محدودي النطق".                               |
| `nav.getStarted`                              | Get started                                                                                          | ابدأ الآن                                                                       | Module 1.5 pivot. Confirm CTA register vs. "ابدأ مجانًا" / "ابدأ معنا".          |
| `nav.signIn`                                  | Sign in                                                                                              | تسجيل الدخول                                                                    | Module 1.5 — same string as legacy `nav.login`. OK.                              |
| `marketing.landing.hero.ctaPrimary`           | Get started — it's free                                                                              | ابدأ الآن — مجانًا                                                              | Module 1.5 pivot. Confirm em-dash convention in AR — Arabic style guides differ. |
| `marketing.landing.hero.subtitle` (extension) | …Free, open, and built to be in every family's pocket.                                               | …مجاني ومفتوح، وصُنع ليكون في جيب كل عائلة.                                     | Module 1.5 pivot. Confirm idiom "في جيب كل عائلة".                               |
| `marketing.landing.hero.freeCaption`          | Free for families, therapists, and educators. No credit card.                                        | مجاني للعائلات والمعالجين والمعلّمين. لا حاجة لبطاقة ائتمان.                    | Module 1.5 pivot.                                                                |
| `marketing.landing.closingCta.subtitle`       | BlueCare is free and open to families, therapists, and schools. Create an account in under a minute. | بلوكير مجاني ومفتوح للعائلات والمعالجين والمدارس. أنشئ حسابك خلال أقل من دقيقة. | Module 1.5 pivot.                                                                |
| `marketing.landing.closingCta.cta`            | Get started                                                                                          | ابدأ الآن                                                                       | Module 1.5 pivot. Same as `nav.getStarted`.                                      |
| `marketing.terms.sections.fees.body`          | (long, free + cap-degrades framing)                                                                  | (long, free + cap-degrades framing)                                             | Module 1.5 pivot — major rewrite. Confirm regulatory tone.                       |
| `marketing.auth.signup.*`                     | (entire namespace)                                                                                   | (entire namespace)                                                              | Module 1.5 stub copy. Confirm clinical/welcoming register.                       |
| `marketing.auth.login.*`                      | (entire namespace)                                                                                   | (entire namespace)                                                              | Module 1.5 stub copy. Confirm clinical/welcoming register.                       |

## Reviewed

_(empty — populated as a reviewer signs off)_

## Reviewer instructions

1. Walk through every row in **Pending review**. For each, either approve
   verbatim or supply a replacement.
2. Move approved rows to **Reviewed** with the reviewer's name and date.
3. Search the codebase for `TODO(translate)` and resolve each.
4. Run `pnpm test:e2e --project chromium -g "Arabic"` to verify visual
   layout in RTL mode.
