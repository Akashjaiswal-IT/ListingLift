"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Language = "hi" | "en";

export interface Translations {
  // Navigation
  nav: {
    home: string;
    dashboard: string;
    myProducts: string;
    newListing: string;
    credits: string;
    pricing: string;
    history: string;
    login: string;
    getStarted: string;
    startRevamping: string;
    profile: string;
    creditsRemaining: string;
  };
  // Hero
  hero: {
    badge: string;
    headline: string;
    headlineAccent: string;
    subheadline: string;
    tryFree: string;
    watchDemo: string;
    originalPhoto: string;
    aiStudioRevamp: string;
    guaranteedWhite: string;
    socialProof: string;
  };
  // Mobile Reseller View
  mobile: {
    starReseller: string;
    boostSales: string;
    boostDesc: string;
    studioRevamp: string;
    studioRevampDesc: string;
    revampBtn: string;
    successStories: string;
    moreInquiries: string;
    popularContexts: string;
    ctxPremium: string;
    ctxLifestyle: string;
    ctxStudio: string;
    ctxFestive: string;
    bottomHome: string;
    bottomCredits: string;
    bottomStore: string;
  };
  // Landing Page Sections
  sections: {
    step1Title: string;
    step1Subtitle: string;
    tapUpload: string;
    supports: string;
    transformStyle: string;
    styleCleanWhite: string;
    styleLifestyle: string;
    styleLuxury: string;
    styleFestive: string;
    customPromptLabel: string;
    customPromptPlaceholder: string;
    generateBtn: string;
    aiResultsTitle: string;
    generatedIn: string;
    selectAndCreate: string;

    step2Title: string;
    step2Subtitle: string;
    tabWhatsapp: string;
    tabMeesho: string;
    tabInstagram: string;
    freeShipping: string;
    codAvailable: string;
    messageToOrder: string;
    copyCaption: string;
    copied: string;
    aiProductDetails: string;
    aiGeneratedTitle: string;
    keyFeatures: string;
    downloadEntireKit: string;

    pricingTitle: string;
    pricingSubtitle: string;
    starterPack: string;
    popularPack: string;
    valuePack: string;
    bulkPack: string;
    buyNow: string;
    customPack: string;
    creditsUnit: string;

    historyTitle: string;
    historySubtitle: string;
    filterAll: string;
    filterWhatsapp: string;
    filterMeesho: string;
    edit: string;
    viewKit: string;
  };
  // Onboarding Tour
  tour: {
    takeTourBtn: string;
    welcomeTitle: string;
    welcomeSubtitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    step4Title: string;
    step4Desc: string;
    next: string;
    prev: string;
    finish: string;
    skip: string;
  };
  // Footer
  footer: {
    tagline: string;
    mission: string;
    colProduct: string;
    colHelp: string;
    colAccount: string;
    rights: string;
    madeWith: string;
  };
  // Auth (Login / Signup)
  auth: {
    loginTitle: string;
    signupTitle: string;
    trialBadge: string;
    heroHeadline: string;
    heroSubtitle: string;
    perk1: string;
    perk2: string;
    perk3: string;
    perk4: string;
    trustText: string;
    copyright: string;
  };
  // Pricing Page
  pricingPage: {
    badge: string;
    title: string;
    titleAccent: string;
    subtitle: string;
    popularBadge: string;
    perCredit: string;
    featuresIncluded: string;
    f1: string;
    f2: string;
    f3: string;
    f4: string;
    buyBtn: string;
    customTitle: string;
    customSubtitle: string;
    selected: string;
    buyCustomBtn: string;
    faqTitle: string;
    faqSubtitle: string;
    faq1Q: string;
    faq1A: string;
    faq2Q: string;
    faq2A: string;
    faq3Q: string;
    faq3A: string;
  };
}

export const translations: Record<Language, Translations> = {
  hi: {
    nav: {
      home: "होम",
      dashboard: "डैशबोर्ड",
      myProducts: "मेरे उत्पाद",
      newListing: "नया कैटलॉग",
      credits: "क्रेडिट्स",
      pricing: "प्राइसिंग",
      history: "इतिहास",
      login: "लॉग इन",
      getStarted: "शुरू करें",
      startRevamping: "कैटलॉग बनाएं",
      profile: "प्रोफ़ाइल",
      creditsRemaining: "क्रेडिट्स शेष",
    },
    hero: {
      badge: "व्हाट्सएप, मीशो और इंस्टाग्राम सेलर्स के लिए",
      headline: "फ़ोन फ़ोटो को बनाएं 8K",
      headlineAccent: "स्टूडियो क्वालिटी",
      subheadline:
        "Meesho, WhatsApp और Insta के लिए ऑटोमेटेड AI बैकग्राउंड रिमूवल, लाइटिंग और लिस्टिंग किट। अपने ₹500 के उत्पाद को बनाएं ₹10,000 जैसा प्रीमियम।",
      tryFree: "मुफ़्त में आज़माएं",
      watchDemo: "डेमो देखें",
      originalPhoto: "फ़ोन की सामान्य फ़ोटो",
      aiStudioRevamp: "AI स्टूडियो रीवैम्प",
      guaranteedWhite: "अमेज़ॅन/फ्लिपकार्ट के लिए 100% प्योर व्हाइट बैकग्राउंड गारंटी",
      socialProof: "10,000+ भारतीय सेलर्स और रीसेलर्स द्वारा भरोसेमंद",
    },
    mobile: {
      starReseller: "स्टार रीसेलर",
      boostSales: "बढ़ाएं अपनी बिक्री",
      boostDesc: "फ़ोन फ़ोटो को बनाएं प्रोफेशनल स्टूडियो लिस्टिंग",
      studioRevamp: "स्टूडियो रीवैम्प",
      studioRevampDesc: "AI बनाएगा आपके प्रोडक्ट्स को सेकंडों में प्रीमियम",
      revampBtn: "प्रोडक्ट फ़ोटो रीवैम्प करें",
      successStories: "सफलता की कहानियां",
      moreInquiries: "+40% अधिक ग्राहक पूछताछ",
      popularContexts: "लोकप्रिय बैकग्राउंड्स",
      ctxPremium: "प्रीमियम",
      ctxLifestyle: "लाइफ़स्टाइल",
      ctxStudio: "स्टूडियो",
      ctxFestive: "फेस्टिव",
      bottomHome: "होम",
      bottomCredits: "क्रेडिट्स",
      bottomStore: "स्टोर",
    },
    sections: {
      step1Title: "1. फ़ोटो अपलोड करें और AI से बनाएं",
      step1Subtitle: "कोई भी फ़ोटो चुनें, हमारा AI कुछ ही सेकंड में जादू करेगा।",
      tapUpload: "प्रोडक्ट फ़ोटो अपलोड करने के लिए टैप करें",
      supports: "PNG, JPG सपोर्टेड (अधिकतम 10MB)",
      transformStyle: "ट्रांसफ़ॉर्मेशन स्टाइल",
      styleCleanWhite: "प्योर स्टूडियो व्हाइट (अमेज़ॅन / फ्लिपकार्ट अनुकूल)",
      styleLifestyle: "वार्म नेचुरल लाइफ़स्टाइल (डेलाइट)",
      styleLuxury: "लक्ज़री डार्क मार्बल विथ शैडो",
      styleFestive: "फेस्टिव इंडियन बैकड्रॉप (त्योहारी)",
      customPromptLabel: "कस्टम बैकग्राउंड निर्देश (वैकल्पिक)",
      customPromptPlaceholder: "जैसे: मार्बल सतह पर सॉफ्ट एम्बिएंट शैडो...",
      generateBtn: "वेरिएशंस बनाएं (2 क्रेडिट्स)",
      aiResultsTitle: "AI रिज़ल्ट्स",
      generatedIn: "4.2 सेकंड में तैयार",
      selectAndCreate: "चुनें और किट बनाएं",

      step2Title: "2. आपकी पूरी लिस्टिंग किट",
      step2Subtitle: "हर प्लेटफ़ॉर्म के लिए AI द्वारा लिखी गई लिस्टिंग कॉपी और सोशल कार्ड्स।",
      tabWhatsapp: "व्हाट्सएप",
      tabMeesho: "मीशो",
      tabInstagram: "इंस्टाग्राम",
      freeShipping: "पूरे भारत में फ़्री शिपिंग",
      codAvailable: "COD उपलब्ध",
      messageToOrder: "ऑर्डर करने के लिए मैसेज करें",
      copyCaption: "कॉपी करें",
      copied: "कॉपी हो गया!",
      aiProductDetails: "AI प्रोडक्ट विवरण",
      aiGeneratedTitle: "AI ऑप्टिमाइज्ड टाइटल",
      keyFeatures: "मुख्य विशेषताएं (Key Features)",
      downloadEntireKit: "पूरी किट डाउनलोड करें (ZIP पैकेज)",

      pricingTitle: "सरल क्रेडिट प्राइसिंग",
      pricingSubtitle: "कोई मासिक सब्सक्रिप्शन नहीं। केवल उतना भुगतान करें जितना आप बनाते हैं।",
      starterPack: "स्टार्टर",
      popularPack: "पॉपुलर",
      valuePack: "वैल्यू",
      bulkPack: "थोक / बल्क",
      buyNow: "अभी खरीदें",
      customPack: "कस्टम क्रेडिट पैक",
      creditsUnit: "क्रेडिट्स",

      historyTitle: "प्रोडक्ट इतिहास",
      historySubtitle: "अपने पिछले बनाए गए प्रोडक्ट्स को पुनः डाउनलोड या एडिट करें।",
      filterAll: "सभी",
      filterWhatsapp: "व्हाट्सएप",
      filterMeesho: "मीशो",
      edit: "री-एडिट",
      viewKit: "किट देखें",
    },
    tour: {
      takeTourBtn: "ऐप टूर देखें",
      welcomeTitle: "Peshkar AI में आपका स्वागत है!",
      welcomeSubtitle: "आइए 1 मिनट में समझें कि आप अपने फ़ोन की फ़ोटो से स्टूडियो कैटलॉग कैसे बना सकते हैं।",
      step1Title: "फ़ोन से फ़ोटो खींचें और अपलोड करें",
      step1Desc: "महंगे कैमरे या लाइटिंग की ज़रूरत नहीं। अपनी सामान्य फ़ोन फ़ोटो अपलोड करें।",
      step2Title: "प्योर व्हाइट + लक्ज़री स्टूडियो बैकग्राउंड",
      step2Desc: "आपको हमेशा एक अमेज़ॅन/फ्लिपकार्ट स्टैंडर्ड व्हाइट बैकग्राउंड और एक प्रीमियम लाइफस्टाइल फ़ोटो मिलती है।",
      step3Title: "व्हाट्सएप और मीशो रेडी किट",
      step3Desc: "AI तुरंत टाइटल, बुलेट पॉइंट्स, व्हाट्सएप ब्रॉडकास्ट मैसेज और 3 ब्रांडेड कार्ड्स तैयार कर देता है।",
      step4Title: "जीरो रिस्क क्रेडिट सुरक्षा",
      step4Desc: "यदि कोई जेनरेशन फ़ेल होती है, तो आपके क्रेडिट्स तुरंत आपके खाते में स्वतः रिफ़ंड हो जाते हैं।",
      next: "अगला →",
      prev: "← पीछे",
      finish: "शुरू करें 🚀",
      skip: "छोड़ें",
    },
    footer: {
      tagline: "Peshkar AI",
      mission: "भारत के 1 करोड़+ सूक्ष्म-रीसेलर्स और D2C ब्रांड्स के लिए बनाया गया AI स्टूडियो।",
      colProduct: "प्रोडक्ट",
      colHelp: "मदद व सपोर्ट",
      colAccount: "अकाउंट",
      rights: "© 2026 Peshkar AI. सर्वाधिकार सुरक्षित।",
      madeWith: "भारतीय रीसेलर्स के लिए ❤️ से निर्मित",
    },
    auth: {
      loginTitle: "अपने खाते में लॉग इन करें",
      signupTitle: "नया खाता बनाएं",
      trialBadge: "साइनअप पर ₹249 मूल्य के 10 मुफ़्त स्टूडियो क्रेडिट्स",
      heroHeadline: "सामान्य फ़ोन फ़ोटो को बनाएं मल्टी-चैनल बिज़नेस",
      heroSubtitle: "आज ही अपना मुफ़्त खाता बनाएं और ₹249 मूल्य के 10 क्रेडिट्स तुरंत पाएं।",
      perk1: "AI स्टूडियो फ़ोटोग्राफ़ी (प्योर व्हाइट बैकग्राउंड और लक्ज़री पेडस्टल)",
      perk2: "मीशो, अमेज़ॅन और फ्लिपकार्ट के लिए ऑटोमेटेड SEO कॉपीराइटिंग",
      perk3: "व्हाट्सएप ब्रॉडकास्ट और इंस्टाग्राम स्टोरी कार्ड्स 1-क्लिक में",
      perk4: "शुरू करने के लिए किसी क्रेडिट कार्ड की आवश्यकता नहीं",
      trustText: "25,000+ भारतीय रीसेलर्स और D2C ब्रांड्स द्वारा भरोसेमंद",
      copyright: "© 2026 Peshkar AI. भारत के वाणिज्य को सशक्त बनाता हुआ।",
    },
    pricingPage: {
      badge: "सरल और पारदर्शी प्राइसिंग",
      title: "उतना ही भुगतान करें जितना आप",
      titleAccent: "बनाते हैं",
      subtitle: "कोई मासिक सब्सक्रिप्शन नहीं। कोई छिपे हुए शुल्क नहीं। क्रेडिट्स कभी एक्सपायर नहीं होते।",
      popularBadge: "सर्वाधिक लोकप्रिय",
      perCredit: "प्रति क्रेडिट",
      featuresIncluded: "शामिल सुविधाएं:",
      f1: "अमेज़ॅन/फ्लिपकार्ट 100% प्योर व्हाइट स्टूडियो फ़ोटो",
      f2: "लक्ज़री पेडस्टल और लाइफ़स्टाइल वेरिएशंस",
      f3: "मीशो व अमेज़ॅन ऑप्टिमाइज़्ड SEO लिस्टिंग कॉपी",
      f4: "व्हाट्सएप और इंस्टाग्राम स्टोरी कार्ड्स + ZIP डाउनलोड",
      buyBtn: "अभी खरीदें",
      customTitle: "कस्टम क्रेडिट पैक",
      customSubtitle: "अपनी सटीक आवश्यकता के अनुसार क्रेडिट्स चुनें (स्लाइडर का उपयोग करें)",
      selected: "चयनित",
      buyCustomBtn: "कस्टम पैक अभी खरीदें",
      faqTitle: "अक्सर पूछे जाने वाले प्रश्न",
      faqSubtitle: "क्रेडिट्स, भुगतान और रिफंड सुरक्षा के बारे में सब कुछ।",
      faq1Q: "1 क्रेडिट से क्या-क्या बनाया जा सकता है?",
      faq1A: "1 क्रेडिट से आप किसी भी फ़ोटो को री-एडिट कर सकते हैं। 2 क्रेडिट्स से आप क्विक स्टूडियो जेनरेशन (2 हाई-डेफिनिशन स्टूडियो फ़ोटो + मीशो कॉपी + व्हाट्सएप/इंस्टाग्राम कार्ड्स) पा सकते हैं।",
      faq2Q: "क्या मेरे खरीदे गए क्रेडिट्स कभी एक्सपायर होंगे?",
      faq2A: "बिल्कुल नहीं! आपके खरीदे गए क्रेडिट्स की कोई समाप्ति तिथि नहीं है। वे आपके खाते में हमेशा सुरक्षित रहते हैं।",
      faq3Q: "अगर कोई जेनरेशन फ़ेल हो जाए तो क्या होगा?",
      faq3A: "हमारी ऑटोमेटेड सुरक्षा प्रणाली तुरंत आपके खाते में क्रेडिट्स स्वतः वापस (Refund) कर देती है। आपका 1 भी क्रेडिट व्यर्थ नहीं जाता।",
    },
  },
  en: {
    nav: {
      home: "Home",
      dashboard: "Dashboard",
      myProducts: "My Products",
      newListing: "New Listing",
      credits: "Credits",
      pricing: "Pricing",
      history: "History",
      login: "Login",
      getStarted: "Get Started",
      startRevamping: "Start Revamping",
      profile: "Profile",
      creditsRemaining: "Credits Remaining",
    },
    hero: {
      badge: "FOR WHATSAPP & INSTAGRAM RESELLERS",
      headline: "Turn Phone Photos into",
      headlineAccent: "Studio Quality",
      subheadline:
        "Automated AI background removal, lighting, and listing kits for Meesho, WhatsApp, and Insta. Make your products look ₹10,000 even if they cost ₹500.",
      tryFree: "Try for Free",
      watchDemo: "Watch Demo",
      originalPhoto: "Original Phone Photo",
      aiStudioRevamp: "AI Studio Revamp",
      guaranteedWhite: "Guaranteed Pure White Background for Amazon & Flipkart",
      socialProof: "Trusted by 10,000+ Indian Resellers & D2C Brands",
    },
    mobile: {
      starReseller: "Star Reseller",
      boostSales: "Boost Your Sales",
      boostDesc: "Turn phone photos into studio listings",
      studioRevamp: "Studio Revamp",
      studioRevampDesc: "AI makes your products look premium in seconds",
      revampBtn: "Revamp Product Photo",
      successStories: "Success Stories",
      moreInquiries: "+40% more buyer inquiries",
      popularContexts: "Popular Contexts",
      ctxPremium: "Premium",
      ctxLifestyle: "Lifestyle",
      ctxStudio: "Studio",
      ctxFestive: "Festive",
      bottomHome: "Home",
      bottomCredits: "Credits",
      bottomStore: "Store",
    },
    sections: {
      step1Title: "1. Upload & AI Revamp",
      step1Subtitle: "Pick a photo. Let our AI work its magic.",
      tapUpload: "Tap to upload product photo",
      supports: "Supports PNG, JPG (Max 10MB)",
      transformStyle: "Transformation Style",
      styleCleanWhite: "Premium Studio (Clean White - Amazon/Flipkart)",
      styleLifestyle: "Warm Lifestyle (Natural Daylight)",
      styleLuxury: "Luxury Dark Marble & Ambient Shadow",
      styleFestive: "Festive Indian Backdrop (Ethnic / Brass)",
      customPromptLabel: "Custom Background Prompt (Optional)",
      customPromptPlaceholder: "e.g. Soft pink aesthetic with marble shadow...",
      generateBtn: "Generate Variations (2 Credits)",
      aiResultsTitle: "AI Results",
      generatedIn: "Generated in 4.2 seconds",
      selectAndCreate: "Select & Create Kit",

      step2Title: "2. Your Listing Kit",
      step2Subtitle: "AI-written copy optimized for every marketplace & social platform.",
      tabWhatsapp: "WhatsApp",
      tabMeesho: "Meesho",
      tabInstagram: "Instagram",
      freeShipping: "Free Shipping Across India",
      codAvailable: "COD Available",
      messageToOrder: "Message to Order",
      copyCaption: "Copy Text",
      copied: "Copied!",
      aiProductDetails: "AI Product Details",
      aiGeneratedTitle: "AI Generated Title",
      keyFeatures: "High-Converting Key Features",
      downloadEntireKit: "Download Entire Kit (ZIP Bundle)",

      pricingTitle: "Simple Credit Pricing",
      pricingSubtitle: "No monthly fees. Pay only for what you generate. Credits never expire.",
      starterPack: "Starter",
      popularPack: "Popular",
      valuePack: "Value",
      bulkPack: "Bulk Wholesale",
      buyNow: "Buy Now",
      customPack: "Custom Credit Pack",
      creditsUnit: "Credits",

      historyTitle: "Product History",
      historySubtitle: "Re-edit or download your past product catalog revamps.",
      filterAll: "All",
      filterWhatsapp: "WhatsApp",
      filterMeesho: "Meesho",
      edit: "Edit",
      viewKit: "View Kit",
    },
    tour: {
      takeTourBtn: "Take App Tour",
      welcomeTitle: "Welcome to Peshkar AI!",
      welcomeSubtitle: "Learn how to transform casual phone photos into studio catalogs in 60 seconds.",
      step1Title: "Shoot on Your Phone",
      step1Desc: "No studio or expensive setup needed. Just take a photo on your smartphone and upload.",
      step2Title: "Pure White & Studio Environments",
      step2Desc: "You always receive one Amazon/Flipkart compliant pure white catalog image plus premium lifestyle scenes.",
      step3Title: "1-Click WhatsApp & Meesho Kits",
      step3Desc: "AI instantly creates marketplace copy, WhatsApp broadcast texts, and 3 branded social cards.",
      step4Title: "Zero-Risk Credit Protection",
      step4Desc: "If any generation fails, your credits are automatically refunded to your balance instantly.",
      next: "Next →",
      prev: "← Back",
      finish: "Start Creating 🚀",
      skip: "Skip",
    },
    footer: {
      tagline: "Peshkar AI",
      mission: "The first AI studio for India's micro-resellers. Empowering 10 million women to grow their business on WhatsApp.",
      colProduct: "Product",
      colHelp: "Help & Support",
      colAccount: "Account",
      rights: "© 2026 Peshkar AI. All rights reserved.",
      madeWith: "Made with ❤️ for Indian Resellers",
    },
    auth: {
      loginTitle: "Sign In to Your Account",
      signupTitle: "Create Your Account",
      trialBadge: "10 Free Studio Credits (Worth ₹249) on Signup",
      heroHeadline: "Turn ordinary phone snaps into multi-channel revenue.",
      heroSubtitle: "Create your free account today & claim 10 Studio Credits (Worth ₹249) instantly.",
      perk1: "AI Studio Photography (White background, luxury pedestals)",
      perk2: "Full Marketplace Catalog Copy + High-Converting Descriptions",
      perk3: "Ready-to-broadcast WhatsApp & Instagram Story Cards",
      perk4: "No credit card required to start",
      trustText: "Trusted by 25,000+ Indian Resellers and D2C Brands",
      copyright: "© 2026 Peshkar AI. Empowering Bharat's Commerce.",
    },
    pricingPage: {
      badge: "Simple & Transparent Pricing",
      title: "Pay Only for What You",
      titleAccent: "Generate",
      subtitle: "No recurring subscriptions. No hidden fees. Credits never expire.",
      popularBadge: "MOST POPULAR",
      perCredit: "per credit",
      featuresIncluded: "Features Included:",
      f1: "Amazon & Flipkart 100% Pure White Studio Photos",
      f2: "Luxury Pedestal & Lifestyle Scene Variations",
      f3: "Meesho & Amazon Optimized SEO Listing Copy",
      f4: "WhatsApp & Instagram Story Cards + ZIP Download",
      buyBtn: "Buy Now",
      customTitle: "Custom Credit Pack",
      customSubtitle: "Choose your exact credit requirement using the interactive slider",
      selected: "selected",
      buyCustomBtn: "Buy Custom Pack Now",
      faqTitle: "Frequently Asked Questions",
      faqSubtitle: "Everything you need to know about credits, payments, and refund safety.",
      faq1Q: "What can I create with 1 credit?",
      faq1A: "1 credit allows you to re-edit an existing image. 2 credits give you a full Quick Studio Generation (2 HD Studio Variations + Marketplace Copy + Social Cards).",
      faq2Q: "Do my purchased credits ever expire?",
      faq2A: "Never! Purchased credits have no expiration date and stay in your account balance permanently until you use them.",
      faq3Q: "What happens if an AI generation fails?",
      faq3A: "Our automated protection engine instantly refunds the debited credits back to your balance immediately. Zero risk.",
    },
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "hi",
  setLanguage: () => {},
  t: translations.hi,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("hi");

  useEffect(() => {
    try {
      const stored = (localStorage.getItem("peshkar_lang") || localStorage.getItem("listinglift_lang")) as Language | null;
      if (stored === "en" || stored === "hi") {
        setLanguageState(stored);
      } else {
        // Default to Hindi per user specification
        setLanguageState("hi");
        localStorage.setItem("peshkar_lang", "hi");
      }
    } catch {
      // Fallback
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("peshkar_lang", lang);
    } catch {}
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
