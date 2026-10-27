import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "~/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Refund & Credit Policy | Peshkar AI",
  description:
    "Read Peshkar AI's policy for credit purchases, completed generations, technical failures, and credit restoration.",
  alternates: { canonical: "/refund-policy" },
};
const sections: LegalSection[] = [
  {
    title: { en: "Completed Generations", hi: "पूर्ण जनरेशन" },
    body: {
      en: "AI results can vary. When a generation completes and its result is available, its credits are used. We do not give a cash refund only because you dislike a result, it has a mistake, or a marketplace rejects it. Review output before publishing.",
      hi: "AI परिणाम अलग-अलग हो सकते हैं। जब जनरेशन पूर्ण होती है और परिणाम उपलब्ध होता है, उसके क्रेडिट्स उपयोग हो जाते हैं। केवल परिणाम पसंद न आने, उसमें गलती होने या मार्केटप्लेस द्वारा अस्वीकार करने पर हम कैश रिफंड नहीं देते। प्रकाशित करने से पहले आउटपुट जांचें।",
    },
  },
  {
    title: { en: "Technical Failure", hi: "तकनीकी विफलता" },
    body: {
      en: "If a verified Peshkar AI technical failure delivers no completed result, we may restore credits charged for that failed generation. Restoration will not exceed credits charged for that generation.",
      hi: "यदि Peshkar AI की सत्यापित तकनीकी विफलता में पूर्ण परिणाम डिलीवर नहीं होता, तो हम उस विफल जनरेशन के लिए लगाए गए क्रेडिट्स वापस कर सकते हैं। वापसी उस जनरेशन के लगाए गए क्रेडिट्स से अधिक नहीं होगी।",
    },
  },
  {
    title: { en: "Purchases, Cancellation, and Review", hi: "खरीद, रद्दीकरण और समीक्षा" },
    body: {
      en: "Credit packs are generally not redeemable for cash. Contact support@peshkarai.in for duplicate charges, incorrect charges, or a technical issue, with your account email and listing or payment order ID. Ending use does not turn unused credits into cash. This policy does not limit a remedy required by law.",
      hi: "क्रेडिट पैक सामान्यतः नकद में रिडीम नहीं किए जा सकते। डुप्लीकेट चार्ज, गलत चार्ज या तकनीकी समस्या के लिए अपने अकाउंट ईमेल और लिस्टिंग या भुगतान ऑर्डर ID के साथ support@peshkarai.in पर संपर्क करें। सेवा का उपयोग बंद करने से अप्रयुक्त क्रेडिट्स नकद में नहीं बदलते। यह नीति कानून द्वारा आवश्यक उपाय को सीमित नहीं करती।",
    },
  },
];
export default function RefundPolicyPage() {
  return (
    <LegalPage
      current="/refund-policy"
      title={{ en: "Refund & Credit Policy", hi: "रिफंड और क्रेडिट पॉलिसी" }}
      sections={sections}
    />
  );
}
