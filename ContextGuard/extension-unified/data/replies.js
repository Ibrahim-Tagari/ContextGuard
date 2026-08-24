// replies.js
//
// Calm, factual messages shown on blocked content. Kept as fixed templates
// (not LLM-generated per post) so tone and factual accuracy stay
// consistent. Review these with subject-matter experts before relying on
// them beyond a prototype.

const HS_REPLIES = {
  slur: {
    label: "Slur",
    message:
      "This term is a slur used to dehumanize Muslims and people perceived as Middle Eastern or South Asian."
  },
  dehumanization: {
    label: "Dehumanizing language",
    message:
      "Comparing a religious or ethnic group to animals or pests is a dehumanization tactic that has historically preceded violence against minority groups."
  },
  incitement: {
    label: "Incitement",
    message:
      "This content calls for harm or exclusion based on religion."
  },
  generalization: {
    label: "Broad generalization",
    message:
      "Muslims are over 1.9 billion people across nearly every country and culture on Earth, with a huge range of beliefs and practices. Claims that '(all) Muslims' think or act one way don't hold up against that diversity."
  },
  invasion_trope: {
    label: "'Invasion/replacement' narrative",
    message:
      "This echoes a debunked conspiracy narrative (sometimes called the 'Great Replacement' or 'Eurabia' theory) that has been cited as motivation in several mass shootings. Migration and demographic change are ordinary social phenomena, not an orchestrated 'takeover.'"
  },
  delegitimize_trope: {
    label: "Delegitimizing framing",
    message:
      "Islam is recognized worldwide as one of the major Abrahamic religions, with the same historical and theological standing as Christianity or Judaism."
  },
  xenophobia: {
    label: "Xenophobic phrase",
    message:
      "This phrase is commonly used to tell people they don't belong based on perceived religion or ethnicity, regardless of their actual citizenship or birthplace."
  },
  terrorism_trope: {
    label: "Terrorism generalization",
    message:
      "The large majority of terrorist attacks in most Western countries are not committed by Muslims, and the vast majority of Muslims condemn terrorism. Attributing terrorism to an entire religion of ~1.9 billion people isn't supported by the data."
  },
  manual: {
    label: "Blocked by you",
    message: "You chose to block this content."
  },
  default: {
    label: "Flagged content",
    message:
      "This content matched a pattern associated with anti-Muslim hate speech or Islamophobia."
  }
};

if (typeof module !== "undefined") {
  module.exports = { HS_REPLIES };
}
