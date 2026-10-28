import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "~/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | Peshkar AI",
  description:
    "Read the Peshkar AI Terms of Service, including account rules, AI output review, credits, payments, and liability terms.",
  alternates: { canonical: "/terms" },
};

const sections: LegalSection[] = [
  {
    title: { en: "Account & Credits", hi: "अकाउंट और क्रेडिट्स" },
    body: {
      en: "You must be at least 18, provide accurate account information, and keep your sign-in secure. You are responsible for account activity. Credits are prepaid, non-transferable, do not expire, and cannot be exchanged for cash.",
      hi: "आपकी उम्र कम-से-कम 18 वर्ष होनी चाहिए, सही अकाउंट जानकारी देनी होगी और साइन-इन सुरक्षित रखना होगा। अकाउंट गतिविधि की जिम्मेदारी आपकी है। क्रेडिट्स प्रीपेड, ट्रांसफर न किए जा सकने वाले, समाप्त न होने वाले हैं और नकद में नहीं बदले जा सकते।",
    },
  },
  {
    title: { en: "AI Results Need Your Review", hi: "AI परिणामों की समीक्षा जरूरी है" },
    body: {
      en: "AI can make mistakes. Images, titles, descriptions, keywords, prices, sizes, colours, and claims may be incomplete, inaccurate, or unsuitable. Review every result before publishing. We do not guarantee accuracy, marketplace approval, sales, ranking, or profit.",
      hi: "AI गलतियाँ कर सकता है। इमेज, टाइटल, विवरण, कीवर्ड, कीमत, साइज़, रंग और दावे अधूरे, गलत या अनुपयुक्त हो सकते हैं। प्रकाशित करने से पहले हर परिणाम जांचें। हम सटीकता, मार्केटप्लेस स्वीकृति, बिक्री, रैंकिंग या लाभ की गारंटी नहीं देते।",
    },
  },
  {
    title: { en: "Your Content and Listings", hi: "आपकी सामग्री और लिस्टिंग" },
    body: {
      en: "You are responsible for uploaded photos, prompts, brands, product information, and final listings. Upload only material you own or are allowed to use, and check that final listings follow the rules of every platform where you publish.",
      hi: "अपलोड किए गए फोटो, प्रॉम्प्ट, ब्रांड, प्रोडक्ट जानकारी और अंतिम लिस्टिंग की जिम्मेदारी आपकी है। केवल वही सामग्री अपलोड करें जिसका उपयोग करने का अधिकार आपको है और जांचें कि अंतिम लिस्टिंग हर प्लेटफॉर्म के नियमों का पालन करती है।",
    },
  },
  {
    title: { en: "Acceptable Use and IP", hi: "स्वीकार्य उपयोग और बौद्धिक संपदा" },
    body: {
      en: "Do not use Peshkar AI for illegal, harmful, deceptive, counterfeit, or rights-infringing content, or unproven medical, safety, environmental, or performance claims. You keep ownership of uploads; where AI-result rights exist and can be transferred, you may use results for your business. We do not guarantee uniqueness, trademark availability, or non-infringement.",
      hi: "Peshkar AI का उपयोग गैरकानूनी, हानिकारक, भ्रामक, नकली या अधिकार-उल्लंघनकारी सामग्री अथवा अप्रमाणित मेडिकल, सुरक्षा, पर्यावरणीय या प्रदर्शन दावों के लिए न करें। अपलोड का स्वामित्व आपका रहता है; जहां AI परिणाम के अधिकार मौजूद हों और हस्तांतरित किए जा सकें, आप उसका व्यवसाय के लिए उपयोग कर सकते हैं। हम अनूठेपन, ट्रेडमार्क उपलब्धता या गैर-उल्लंघन की गारंटी नहीं देते।",
    },
  },
  {
    title: { en: "Payments and Refunds", hi: "भुगतान और रिफंड" },
    body: {
      en: "Razorpay handles payments. We record the accepted policy version and time with each order. Completed generations use credits; a verified technical failure may receive restoration of credits charged for that failed generation. We do not offer subscriptions.",
      hi: "भुगतान Razorpay द्वारा संभाला जाता है। हम हर ऑर्डर के साथ स्वीकार की गई पॉलिसी का वर्जन और समय रिकॉर्ड करते हैं। पूर्ण जनरेशन में क्रेडिट्स उपयोग हो जाते हैं; सत्यापित तकनीकी विफलता पर उस विफल जनरेशन के क्रेडिट्स लौटाए जा सकते हैं। हम सब्सक्रिप्शन उपलब्ध नहीं कराते।",
    },
  },
  {
    title: { en: "Service, Liability, and Contact", hi: "सेवा, जिम्मेदारी और संपर्क" },
    body: {
      en: "We may change, pause, or discontinue features when reasonably necessary. The service is provided as available. To the maximum extent permitted by law, we are not responsible for indirect loss, lost sales, rejected listings, or AI output; total liability is capped at fees paid in the 12 months before a claim. Rights that law cannot remove remain. Indian law applies. Contact peshkarai.support@gmail.com for help or complaints.",
      hi: "आवश्यक होने पर हम फीचर बदल, रोक या बंद कर सकते हैं। सेवा उपलब्धता के आधार पर दी जाती है। कानून द्वारा अनुमत सीमा तक, हम अप्रत्यक्ष हानि, खोई बिक्री, अस्वीकृत लिस्टिंग या AI आउटपुट के लिए जिम्मेदार नहीं हैं; कुल जिम्मेदारी दावे से पहले 12 महीनों में चुकाई गई फीस तक सीमित है। कानून से न हटाए जा सकने वाले अधिकार बने रहते हैं। भारतीय कानून लागू है। सहायता या शिकायत के लिए peshkarai.support@gmail.com पर संपर्क करें।",
    },
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      title={{ en: "Terms of Service", hi: "सेवा की शर्तें" }}
      sections={sections}
    />
  );
}
