import { LegalPage, type LegalSection } from "~/components/legal/LegalPage";

const sections: LegalSection[] = [
  {
    title: { en: "Information We Collect", hi: "हम कौन-सी जानकारी लेते हैं" },
    body: {
      en: "We collect account details, seller details you provide, product photos, prompts, listing details, credit and payment records, and basic device and usage information.",
      hi: "हम अकाउंट विवरण, आपके द्वारा दी गई सेलर जानकारी, प्रोडक्ट फोटो, प्रॉम्प्ट, लिस्टिंग विवरण, क्रेडिट और भुगतान रिकॉर्ड तथा बुनियादी डिवाइस और उपयोग जानकारी लेते हैं।",
    },
  },
  {
    title: { en: "Processing and Sharing", hi: "प्रोसेसिंग और साझा करना" },
    body: {
      en: "We use Cloudflare R2 for assets; OpenAI and Google Gemini for requested AI work; Clerk for authentication; Razorpay for payments; and PostHog for analytics. We do not sell your catalog images or personal information.",
      hi: "हम एसेट्स के लिए Cloudflare R2, आपके अनुरोधित AI कार्य के लिए OpenAI और Google Gemini, प्रमाणीकरण के लिए Clerk, भुगतान के लिए Razorpay और एनालिटिक्स के लिए PostHog का उपयोग करते हैं। हम आपकी कैटलॉग इमेज या व्यक्तिगत जानकारी नहीं बेचते।",
    },
  },
  {
    title: { en: "Why We Use It", hi: "हम इसका उपयोग क्यों करते हैं" },
    body: {
      en: "We use information to deliver assets, manage accounts and credits, process payments, prevent fraud and misuse, answer support requests, secure the service, and improve the product.",
      hi: "हम जानकारी का उपयोग एसेट डिलीवर करने, अकाउंट और क्रेडिट मैनेज करने, भुगतान प्रोसेस करने, धोखाधड़ी रोकने, सहायता अनुरोधों का उत्तर देने, सेवा सुरक्षित रखने और प्रोडक्ट बेहतर बनाने के लिए करते हैं।",
    },
  },
  {
    title: {
      en: "Cookies, Retention, and Your Choices",
      hi: "कुकीज़, स्टोरेज अवधि और आपके विकल्प",
    },
    body: {
      en: "Cookies help sign-in, preferences, measurement, and security. We keep information only as reasonably needed for the service, disputes, fraud prevention, and legal or accounting duties. You may ask to access, correct, delete, or obtain a copy of your information at support@peshkarai.in; we may verify your request and retain limited information where required.",
      hi: "कुकीज़ साइन-इन, प्राथमिकताएं, मापन और सुरक्षा में मदद करती हैं। हम जानकारी केवल सेवा, विवाद, धोखाधड़ी रोकथाम और कानूनी या लेखा दायित्वों के लिए उचित अवधि तक रखते हैं। आप support@peshkarai.in पर अपनी जानकारी देखने, सुधारने, हटाने या कॉपी पाने का अनुरोध कर सकते हैं; हम अनुरोध सत्यापित कर सकते हैं और आवश्यक होने पर सीमित जानकारी रख सकते हैं।",
    },
  },
  {
    title: { en: "Children, Security, and Updates", hi: "बच्चे, सुरक्षा और अपडेट" },
    body: {
      en: "Peshkar AI is not for people under 18. We use reasonable measures to protect information, but no online service can guarantee perfect security. We may update this policy and give additional notice of material changes where practical.",
      hi: "Peshkar AI 18 वर्ष से कम आयु के लोगों के लिए नहीं है। हम जानकारी की सुरक्षा के लिए उचित उपाय अपनाते हैं, लेकिन कोई ऑनलाइन सेवा पूर्ण सुरक्षा की गारंटी नहीं दे सकती। हम इस नीति को अपडेट कर सकते हैं और महत्वपूर्ण बदलावों की अतिरिक्त सूचना जहां संभव हो देंगे।",
    },
  },
];
export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      title={{ en: "Privacy Policy", hi: "गोपनीयता नीति" }}
      sections={sections}
    />
  );
}
