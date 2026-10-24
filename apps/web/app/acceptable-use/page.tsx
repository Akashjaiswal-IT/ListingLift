import { LegalPage, type LegalSection } from "~/components/legal/LegalPage";
const sections: LegalSection[] = [
  {
    title: { en: "Only Upload What You Can Use", hi: "केवल अधिकृत सामग्री अपलोड करें" },
    body: {
      en: "Upload only photos, logos, product details, and brand material you own or may use. Do not upload counterfeit products, copied images, private information, or material that breaks copyright, trademark, or other rights.",
      hi: "केवल वही फोटो, लोगो, प्रोडक्ट विवरण और ब्रांड सामग्री अपलोड करें जिनके आप मालिक हैं या उपयोग कर सकते हैं। नकली प्रोडक्ट, कॉपी की गई इमेज, निजी जानकारी या कॉपीराइट, ट्रेडमार्क अथवा अन्य अधिकार तोड़ने वाली सामग्री अपलोड न करें।",
    },
  },
  {
    title: { en: "Keep Listings True", hi: "लिस्टिंग सही रखें" },
    body: {
      en: "Check that final images and copy match the real product. Do not publish claims such as 100% organic, doctor approved, chemical-free, guaranteed, or best unless you can prove they are true and permitted.",
      hi: "जांचें कि अंतिम इमेज और कॉपी वास्तविक प्रोडक्ट से मेल खाते हैं। 100% ऑर्गेनिक, डॉक्टर अप्रूव्ड, केमिकल-फ्री, गारंटीड या बेस्ट जैसे दावे तब तक प्रकाशित न करें जब तक आप उन्हें सत्य और अनुमत साबित न कर सकें।",
    },
  },
  {
    title: {
      en: "Restricted Use and Marketplace Checks",
      hi: "प्रतिबंधित उपयोग और मार्केटप्लेस जांच",
    },
    body: {
      en: "Do not use the service for illegal, harmful, deceptive, hateful, sexually explicit, defamatory, fraudulent, counterfeit, or restricted content. Platforms may reject AI-created listings. You must check the current rules of every marketplace before publication.",
      hi: "सेवा का उपयोग गैरकानूनी, हानिकारक, भ्रामक, घृणास्पद, यौन रूप से स्पष्ट, मानहानिकारक, धोखाधड़ीपूर्ण, नकली या प्रतिबंधित सामग्री के लिए न करें। प्लेटफॉर्म AI-निर्मित लिस्टिंग को अस्वीकार कर सकते हैं। प्रकाशित करने से पहले हर मार्केटप्लेस के वर्तमान नियम जांचना आपकी जिम्मेदारी है।",
    },
  },
  {
    title: { en: "Enforcement", hi: "प्रवर्तन" },
    body: {
      en: "We may remove content, suspend access, or close an account where we reasonably believe these rules or applicable law have been broken. Report misuse to support@peshkarai.in.",
      hi: "जहां हमें उचित रूप से लगे कि इन नियमों या लागू कानून का उल्लंघन हुआ है, हम सामग्री हटा सकते हैं, एक्सेस निलंबित कर सकते हैं या अकाउंट बंद कर सकते हैं। दुरुपयोग की रिपोर्ट support@peshkarai.in पर करें।",
    },
  },
];
export default function AcceptableUsePage() {
  return (
    <LegalPage
      current="/acceptable-use"
      title={{
        en: "Acceptable Use & Marketplace Rules",
        hi: "स्वीकार्य उपयोग और मार्केटप्लेस नियम",
      }}
      sections={sections}
    />
  );
}
