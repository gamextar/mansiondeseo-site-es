import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Sliders, Eye, EyeOff, Image, Crown, MessageCircle, Shield, Globe, Lock, DollarSign, Smartphone, Monitor, Smile, Gift, Plus, Trash2, CreditCard, Upload, User, Users, Heart, Navigation, Film, Clapperboard, Mail, Activity } from 'lucide-react';
import { getSettings, updateSettings, adminGetGifts, adminCreateGift, adminDeleteGift, adminRemoveAllVip, adminResetAllCoins, uploadImage } from '../lib/api';
import { useAuth } from '../lib/authContext';
import { getApiDebugSummary, resetApiDebugRoute, resetApiDebugSession, setApiDebugEnabled, subscribeApiDebug } from '../lib/api';
import { estimateRealtimeLoad, getRealtimeDebugSummary, resetRealtimeDebug, subscribeRealtimeDebug } from '../lib/realtimeDebug';
import { getMediaDebugSummary, inspectVisibleMedia, resetMediaDebug, subscribeMediaDebug } from '../lib/mediaDebug';
import { getDebugPanelPrefs, setDebugPanelPref, subscribeDebugPanelPrefs } from '../lib/debugPanelPrefs';
import { clearBootDebugFlags, getBootDebugFlags, setBootDebugFlags, subscribeBootDebugFlags } from '../lib/bootDebugPrefs';
import { ADMIN_SECTIONS } from '../lib/adminSections';
import {
  BOTTOM_NAV_HEIGHT,
  BOTTOM_NAV_PAGE_EXTRA_PADDING,
  BOTTOM_NAV_SIDE_PADDING,
  BOTTOM_NAV_VISUAL_OFFSET,
  STANDALONE_BOTTOM_NAV_HEIGHT,
  STANDALONE_BOTTOM_NAV_PAGE_EXTRA_PADDING,
  STANDALONE_BOTTOM_NAV_VISUAL_OFFSET,
} from '../lib/bottomNavConfig';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setSiteSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Photo & Blur
  const [blurMobile, setBlurMobile] = useState(14);
  const [blurDesktop, setBlurDesktop] = useState(8);
  const [freeVisiblePhotos, setFreeVisiblePhotos] = useState(1);

  // VIP
  const [showVipButton, setShowVipButton] = useState(true);
  const [vipPriceMonthly, setVipPriceMonthly] = useState('');
  const [vipPrice3Months, setVipPrice3Months] = useState('');
  const [vipPrice6Months, setVipPrice6Months] = useState('');

  // Messaging
  const [dailyMessageLimit, setDailyMessageLimit] = useState(5);
  const [onlineThresholdMinutes, setOnlineThresholdMinutes] = useState(60);

  // Site
  const [siteCountry, setSiteCountry] = useState('AR');
  const [allowedCountries, setAllowedCountries] = useState('AR');
  const [hidePasswordRegister, setHidePasswordRegister] = useState(true);
  const [feedFilterByCountry, setFeedFilterByCountry] = useState(false);
  const [feedWeightLastActive, setFeedWeightLastActive] = useState(45);
  const [feedWeightStory, setFeedWeightStory] = useState(18);
  const [feedWeightPhotos, setFeedWeightPhotos] = useState(12);
  const [feedWeightFollowers, setFeedWeightFollowers] = useState(10);
  const [feedWeightSharedInterests, setFeedWeightSharedInterests] = useState(20);
  const [feedWeightPremium, setFeedWeightPremium] = useState(8);
  const [feedCardsPerPage, setFeedCardsPerPage] = useState(12);
  const [feedMaxPages, setFeedMaxPages] = useState(10);
  const [feedPrefetchPages, setFeedPrefetchPages] = useState(6);

  // Coin packs
  const [coinPack1Coins, setCoinPack1Coins] = useState('1000');
  const [coinPack1Price, setCoinPack1Price] = useState('');
  const [coinPack2Coins, setCoinPack2Coins] = useState('2000');
  const [coinPack2Price, setCoinPack2Price] = useState('');
  const [coinPack3Coins, setCoinPack3Coins] = useState('3000');
  const [coinPack3Price, setCoinPack3Price] = useState('');

  // Iconografía
  const [incognitoIconSvg, setIncognitoIconSvg] = useState('');
  const [roleHombreImg, setRoleHombreImg] = useState('');
  const [roleMujerImg, setRoleMujerImg] = useState('');
  const [roleParejaImg, setRoleParejaImg] = useState('');
  const [roleParejaHombresImg, setRoleParejaHombresImg] = useState('');
  const [roleParejaMujeresImg, setRoleParejaMujeresImg] = useState('');
  const [roleTransImg, setRoleTransImg] = useState('');
  const [galleryHombreImg, setGalleryHombreImg] = useState('');
  const [galleryMujerImg, setGalleryMujerImg] = useState('');
  const [galleryParejaImg, setGalleryParejaImg] = useState('');
  const [galleryParejaHombresImg, setGalleryParejaHombresImg] = useState('');
  const [galleryParejaMujeresImg, setGalleryParejaMujeresImg] = useState('');
  const [galleryTransImg, setGalleryTransImg] = useState('');

  // Navegacion inferior
  const [navBottomPadding, setNavBottomPadding] = useState(24);
  const [navSidePadding, setNavSidePadding] = useState(16);
  const [navHeight, setNavHeight] = useState(71);
  const [navOpacity, setNavOpacity] = useState(40);
  const [navBlur, setNavBlur] = useState(24);
  const [storyCirclePresetSmall, setStoryCirclePresetSmall] = useState(72);
  const [storyCirclePresetMedium, setStoryCirclePresetMedium] = useState(88);
  const [storyCirclePresetLarge, setStoryCirclePresetLarge] = useState(104);
  const [storyCirclePresetXl, setStoryCirclePresetXl] = useState(154);
  const [storyCircleGap, setStoryCircleGap] = useState(8);
  const [storyCircleBorder, setStoryCircleBorder] = useState(4);
  const [storyCircleInnerGap, setStoryCircleInnerGap] = useState(3);
  const [homeStoryCountMobile, setHomeStoryCountMobile] = useState(15);
  const [homeStoryCountDesktop, setHomeStoryCountDesktop] = useState(30);
  const [sidebarStoryRingWidth, setSidebarStoryRingWidth] = useState(4);
  const [storyPresetEditor, setStoryPresetEditor] = useState('medium');
  const [avatarSizeDraft, setAvatarSizeDraft] = useState('88');

  // Video feed
  const [videoGradientHeight, setVideoGradientHeight] = useState(64);
  const [videoGradientOpacity, setVideoGradientOpacity] = useState(40);
  const [videoAvatarSize, setVideoAvatarSize] = useState(52);
  const [storyMaxDurationSeconds, setStoryMaxDurationSeconds] = useState('15');

  // Encoder
  const [encoderThreads, setEncoderThreads] = useState('4');
  const [encoderCrf, setEncoderCrf] = useState('29');
  const [encoderMaxrate, setEncoderMaxrate] = useState('2700k');
  const [encoderBufsize, setEncoderBufsize] = useState('8000k');
  const [encoderAudioBitrate, setEncoderAudioBitrate] = useState('64k');
  const [encoderAudioMono, setEncoderAudioMono] = useState(true);
  const [encoderPreset, setEncoderPreset] = useState('superfast');
  const [encoderShowProgressHud, setEncoderShowProgressHud] = useState(false);

  // Email (Resend)
  const [resendApiKey, setResendApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [mailFrom, setMailFrom] = useState('');

  // Payment display
  const [paymentTitleVip, setPaymentTitleVip] = useState('Servicios Digitales');
  const [paymentDescriptorVip, setPaymentDescriptorVip] = useState('UNICOAPPS');
  const [paymentTitleCoins, setPaymentTitleCoins] = useState('Servicios Digitales');
  const [paymentDescriptorCoins, setPaymentDescriptorCoins] = useState('UNICOAPPS');

  // Payment gateway
  const [paymentGateway, setPaymentGateway] = useState('mercadopago');

  // Gift catalog
  const [gifts, setGifts] = useState([]);
  const [newGiftName, setNewGiftName] = useState('');
  const [newGiftEmoji, setNewGiftEmoji] = useState('');
  const [newGiftPrice, setNewGiftPrice] = useState('');
  const [newGiftCategory, setNewGiftCategory] = useState('general');
  const [apiDebugSummary, setApiDebugSummary] = useState(() => getApiDebugSummary());
  const [realtimeDebugSummary, setRealtimeDebugSummary] = useState(() => getRealtimeDebugSummary());
  const [mediaDebugSummary, setMediaDebugSummary] = useState(() => getMediaDebugSummary());
  const [debugPanelPrefs, setDebugPanelPrefs] = useState(() => getDebugPanelPrefs());
  const [bootDebugFlags, setBootDebugFlagsState] = useState(() => getBootDebugFlags());
  const [swResetting, setSwResetting] = useState(false);
  const [swResetStatus, setSwResetStatus] = useState('');
  const realtimeEstimate = estimateRealtimeLoad(realtimeDebugSummary);
  const mediaAutoTimerRef = useRef(null);
  const lastMediaAutoKeyRef = useRef('');

  const storyPresetOptions = [
    {
      key: 'small',
      label: 'Chico',
      context: 'chips compactos o mini avatares',
      size: storyCirclePresetSmall,
      setSize: setStoryCirclePresetSmall,
    },
    {
      key: 'medium',
      label: 'Stories',
      context: 'tamaño usado en la fila de stories de la home',
      size: storyCirclePresetMedium,
      setSize: setStoryCirclePresetMedium,
    },
    {
      key: 'large',
      label: 'Destacado',
      context: 'variantes más amplias dentro de la interfaz',
      size: storyCirclePresetLarge,
      setSize: setStoryCirclePresetLarge,
    },
    {
      key: 'xl',
      label: 'Sidebar desktop',
      context: 'tamaño usado por el avatar de la sidebar desktop',
      size: storyCirclePresetXl,
      setSize: setStoryCirclePresetXl,
    },
  ];
  const activeStoryPreset = storyPresetOptions.find(option => option.key === storyPresetEditor) || storyPresetOptions[1];
  const activeStoryPresetBorder = storyPresetEditor === 'xl' ? sidebarStoryRingWidth : storyCircleBorder;
  const activeStoryPresetRingPx = Math.max(1, Math.round((activeStoryPreset.size * activeStoryPresetBorder) / 100));
  const activeStoryPresetInnerGapPx = Math.max(0, Math.round((activeStoryPreset.size * storyCircleInnerGap) / 100));
  const storyCircleGapPx = Math.max(0, Math.round((storyCirclePresetMedium * storyCircleGap) / 100));
  const storyCircleBorderPx = Math.max(1, Math.round((storyCirclePresetMedium * storyCircleBorder) / 100));
  const storyCircleInnerGapPx = Math.max(0, Math.round((storyCirclePresetMedium * storyCircleInnerGap) / 100));

  useEffect(() => {
    setAvatarSizeDraft(String(activeStoryPreset.size));
  }, [activeStoryPreset.size, storyPresetEditor]);

  const commitAvatarSizeDraft = () => {
    const parsed = Number(avatarSizeDraft);
    const fallback = activeStoryPreset.size;
    const next = Number.isFinite(parsed) ? Math.max(40, Math.min(220, parsed)) : fallback;
    activeStoryPreset.setSize(next);
    setAvatarSizeDraft(String(next));
    return next;
  };

  useEffect(() => {
    if (!user?.is_admin) { navigate('/feed'); return; }
    getSettings()
      .then(data => {
        const s = data.settings;
        setBlurMobile(s.blurMobile);
        setBlurDesktop(s.blurDesktop);
        setFreeVisiblePhotos(s.freeVisiblePhotos);
        setShowVipButton(s.showVipButton);
        setDailyMessageLimit(s.dailyMessageLimit);
        setOnlineThresholdMinutes(s.onlineThresholdMinutes ?? 60);
        setSiteCountry(s.siteCountry);
        setAllowedCountries(s.allowedCountries || 'AR');
        setHidePasswordRegister(s.hidePasswordRegister);
        setFeedFilterByCountry(s.feedFilterByCountry === true);
        setFeedWeightLastActive(s.feedWeightLastActive ?? 45);
        setFeedWeightStory(s.feedWeightStory ?? 18);
        setFeedWeightPhotos(s.feedWeightPhotos ?? 12);
        setFeedWeightFollowers(s.feedWeightFollowers ?? 10);
        setFeedWeightSharedInterests(s.feedWeightSharedInterests ?? 20);
        setFeedWeightPremium(s.feedWeightPremium ?? 8);
        setFeedCardsPerPage(s.feedCardsPerPage ?? 12);
        setFeedMaxPages(s.feedMaxPages ?? 10);
        setFeedPrefetchPages(s.feedPrefetchPages ?? 6);
        setVipPrice3Months(s.vipPrice3Months);
        setVipPrice6Months(s.vipPrice6Months);
        setIncognitoIconSvg(s.incognitoIconSvg || '');
        setRoleHombreImg(s.roleHombreImg || '');
        setRoleMujerImg(s.roleMujerImg || '');
        setRoleParejaImg(s.roleParejaImg || '');
        setRoleParejaHombresImg(s.roleParejaHombresImg || '');
        setRoleParejaMujeresImg(s.roleParejaMujeresImg || '');
        setRoleTransImg(s.roleTransImg || '');
        setGalleryHombreImg(s.galleryHombreImg || '');
        setGalleryMujerImg(s.galleryMujerImg || '');
        setGalleryParejaImg(s.galleryParejaImg || '');
        setGalleryParejaHombresImg(s.galleryParejaHombresImg || '');
        setGalleryParejaMujeresImg(s.galleryParejaMujeresImg || '');
        setGalleryTransImg(s.galleryTransImg || '');
        setCoinPack1Coins(s.coinPack1Coins || '1000');
        setCoinPack1Price(s.coinPack1Price || '');
        setCoinPack2Coins(s.coinPack2Coins || '2000');
        setCoinPack2Price(s.coinPack2Price || '');
        setCoinPack3Coins(s.coinPack3Coins || '3000');
        setCoinPack3Price(s.coinPack3Price || '');
        setPaymentTitleVip(s.paymentTitleVip || 'Servicios Digitales');
        setPaymentDescriptorVip(s.paymentDescriptorVip || 'UNICOAPPS');
        setPaymentTitleCoins(s.paymentTitleCoins || 'Servicios Digitales');
        setPaymentDescriptorCoins(s.paymentDescriptorCoins || 'UNICOAPPS');
        setPaymentGateway(s.paymentGateway || 'mercadopago');
        setNavBottomPadding(s.navBottomPadding ?? 24);
        setNavSidePadding(s.navSidePadding ?? 16);
        setNavHeight(s.navHeight ?? 71);
        setNavOpacity(s.navOpacity ?? 40);
        setNavBlur(s.navBlur ?? 24);
        setStoryCirclePresetSmall(s.storyCirclePresetSmall ?? 72);
        setStoryCirclePresetMedium(s.storyCirclePresetMedium ?? s.storyCircleSize ?? 88);
        setStoryCirclePresetLarge(s.storyCirclePresetLarge ?? 104);
        setStoryCirclePresetXl(s.storyCirclePresetXl ?? s.sidebarAvatarSize ?? 154);
        setStoryCircleGap(s.storyCircleGap ?? 8);
        setStoryCircleBorder(s.storyCircleBorder ?? 4);
        setStoryCircleInnerGap(s.storyCircleInnerGap ?? 3);
        setHomeStoryCountMobile(s.homeStoryCountMobile ?? 15);
        setHomeStoryCountDesktop(s.homeStoryCountDesktop ?? 30);
        setSidebarStoryRingWidth(s.sidebarStoryRingWidth ?? s.storyCircleBorder ?? 4);
        setVideoGradientHeight(s.videoGradientHeight ?? 64);
        setVideoGradientOpacity(s.videoGradientOpacity ?? 40);
        setVideoAvatarSize(s.videoAvatarSize ?? 52);
        setStoryMaxDurationSeconds(String(s.storyMaxDurationSeconds ?? 15));
        setEncoderThreads(String(s.encoderThreads ?? 4));
        setEncoderCrf(s.encoderCrf || '29');
        setEncoderMaxrate(s.encoderMaxrate || '2700k');
        setEncoderBufsize(s.encoderBufsize || '8000k');
        setEncoderAudioBitrate(s.encoderAudioBitrate || '64k');
        setEncoderAudioMono(s.encoderAudioMono ?? true);
        setEncoderPreset(s.encoderPreset || 'superfast');
        setEncoderShowProgressHud(s.encoderShowProgressHud === true);
        setResendApiKey(s.resendApiKey || '');
        setMailFrom(s.mailFrom || '');
      })
      .catch(() => navigate('/feed'))
      .finally(() => setLoading(false));
    adminGetGifts().then(data => setGifts(data.gifts || [])).catch(() => {});
  }, [user, navigate]);

  useEffect(() => subscribeApiDebug((nextSummary) => {
    setApiDebugSummary(nextSummary);
  }), []);

  useEffect(() => subscribeRealtimeDebug((nextSummary) => {
    setRealtimeDebugSummary(nextSummary);
  }), []);

  useEffect(() => subscribeMediaDebug((nextSummary) => {
    setMediaDebugSummary(nextSummary);
  }), []);

  useEffect(() => subscribeDebugPanelPrefs((nextPrefs) => {
    setDebugPanelPrefs(nextPrefs);
  }), []);

  useEffect(() => subscribeBootDebugFlags((nextFlags) => {
    setBootDebugFlagsState(nextFlags);
  }), []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRealtimeDebugSummary(getRealtimeDebugSummary());
    }, 5_000);
    return () => window.clearInterval(timer);
  }, []);

  const applyBootDebugFlags = (nextFlags, reload = false) => {
    const next = setBootDebugFlags(nextFlags);
    setBootDebugFlagsState(next);
    if (reload && typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const clearBootDebugAndReload = () => {
    const next = clearBootDebugFlags();
    setBootDebugFlagsState(next);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const unregisterServiceWorkersAndReload = async () => {
    if (typeof window === 'undefined') return;
    setSwResetting(true);
    setSwResetStatus('');
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      setSwResetStatus('Service worker y caches borrados. Recargando...');
      window.setTimeout(() => window.location.reload(), 120);
    } catch {
      setSwResetStatus('No pude limpiar el service worker en esta prueba.');
      setSwResetting(false);
    }
  };

  const handleSave = async () => {
    const parsedDraft = Number(avatarSizeDraft);
    const committedDraftSize = Number.isFinite(parsedDraft)
      ? Math.max(40, Math.min(220, parsedDraft))
      : activeStoryPreset.size;
    const nextPresetSmall = storyPresetEditor === 'small' ? committedDraftSize : storyCirclePresetSmall;
    const nextPresetMedium = storyPresetEditor === 'medium' ? committedDraftSize : storyCirclePresetMedium;
    const nextPresetLarge = storyPresetEditor === 'large' ? committedDraftSize : storyCirclePresetLarge;
    const nextPresetXl = storyPresetEditor === 'xl' ? committedDraftSize : storyCirclePresetXl;

    if (storyPresetEditor === 'small') setStoryCirclePresetSmall(committedDraftSize);
    if (storyPresetEditor === 'medium') setStoryCirclePresetMedium(committedDraftSize);
    if (storyPresetEditor === 'large') setStoryCirclePresetLarge(committedDraftSize);
    if (storyPresetEditor === 'xl') setStoryCirclePresetXl(committedDraftSize);
    setAvatarSizeDraft(String(committedDraftSize));

    setSaving(true);
    setSaved(false);
    try {
      const data = await updateSettings({
        blur_mobile: blurMobile,
        blur_desktop: blurDesktop,
        free_visible_photos: freeVisiblePhotos,
        show_vip_button: showVipButton ? '1' : '0',
        daily_message_limit: dailyMessageLimit,
        online_threshold_minutes: onlineThresholdMinutes,
        site_country: siteCountry,
        allowed_countries: allowedCountries,
        hide_password_register: hidePasswordRegister ? '1' : '0',
        feed_filter_by_country: feedFilterByCountry ? '1' : '0',
        feed_weight_last_active: feedWeightLastActive,
        feed_weight_story: feedWeightStory,
        feed_weight_photos: feedWeightPhotos,
        feed_weight_followers: feedWeightFollowers,
        feed_weight_shared_interests: feedWeightSharedInterests,
        feed_weight_premium: feedWeightPremium,
        feed_cards_per_page: feedCardsPerPage,
        feed_max_pages: feedMaxPages,
        feed_prefetch_pages: feedPrefetchPages,
        vip_price_monthly: vipPriceMonthly,
        vip_price_3months: vipPrice3Months,
        vip_price_6months: vipPrice6Months,
        incognito_icon_svg: incognitoIconSvg,
        role_hombre_img: roleHombreImg,
        role_mujer_img: roleMujerImg,
        role_pareja_img: roleParejaImg,
        role_pareja_hombres_img: roleParejaHombresImg,
        role_pareja_mujeres_img: roleParejaMujeresImg,
        role_trans_img: roleTransImg,
        gallery_hombre_img: galleryHombreImg,
        gallery_mujer_img: galleryMujerImg,
        gallery_pareja_img: galleryParejaImg,
        gallery_pareja_hombres_img: galleryParejaHombresImg,
        gallery_pareja_mujeres_img: galleryParejaMujeresImg,
        gallery_trans_img: galleryTransImg,
        coin_pack_1_coins: coinPack1Coins,
        coin_pack_1_price: coinPack1Price,
        coin_pack_2_coins: coinPack2Coins,
        coin_pack_2_price: coinPack2Price,
        coin_pack_3_coins: coinPack3Coins,
        coin_pack_3_price: coinPack3Price,
        payment_title_vip: paymentTitleVip,
        payment_descriptor_vip: paymentDescriptorVip,
        payment_title_coins: paymentTitleCoins,
        payment_descriptor_coins: paymentDescriptorCoins,
        payment_gateway: paymentGateway,
        story_circle_size: nextPresetMedium,
        story_circle_preset_small: nextPresetSmall,
        story_circle_preset_medium: nextPresetMedium,
        story_circle_preset_large: nextPresetLarge,
        story_circle_preset_xl: nextPresetXl,
        sidebar_avatar_size: nextPresetXl,
        story_circle_gap: storyCircleGap,
        story_circle_border: storyCircleBorder,
        story_circle_inner_gap: storyCircleInnerGap,
        home_story_count_mobile: homeStoryCountMobile,
        home_story_count_desktop: homeStoryCountDesktop,
        sidebar_story_ring_width: sidebarStoryRingWidth,
        video_gradient_height: videoGradientHeight,
        video_gradient_opacity: videoGradientOpacity,
        video_avatar_size: videoAvatarSize,
        story_max_duration_seconds: storyMaxDurationSeconds,
        encoder_threads: encoderThreads,
        encoder_crf: encoderCrf,
        encoder_maxrate: encoderMaxrate,
        encoder_bufsize: encoderBufsize,
        encoder_audio_bitrate: encoderAudioBitrate,
        encoder_audio_mono: encoderAudioMono ? '1' : '0',
        encoder_preset: encoderPreset,
        encoder_show_progress_hud: encoderShowProgressHud ? '1' : '0',
        resend_api_key: resendApiKey,
        mail_from: mailFrom,
      });
      const s = data.settings;
      setBlurMobile(s.blurMobile);
      setBlurDesktop(s.blurDesktop);
      setFreeVisiblePhotos(s.freeVisiblePhotos);
      setShowVipButton(s.showVipButton);
      setDailyMessageLimit(s.dailyMessageLimit);
      setOnlineThresholdMinutes(s.onlineThresholdMinutes ?? 60);
      setSiteCountry(s.siteCountry);
      setAllowedCountries(s.allowedCountries || 'AR');
      setHidePasswordRegister(s.hidePasswordRegister);
      setFeedFilterByCountry(s.feedFilterByCountry === true);
      setFeedWeightLastActive(s.feedWeightLastActive ?? 45);
      setFeedWeightStory(s.feedWeightStory ?? 18);
      setFeedWeightPhotos(s.feedWeightPhotos ?? 12);
      setFeedWeightFollowers(s.feedWeightFollowers ?? 10);
      setFeedWeightSharedInterests(s.feedWeightSharedInterests ?? 20);
      setFeedWeightPremium(s.feedWeightPremium ?? 8);
      setFeedCardsPerPage(s.feedCardsPerPage ?? 12);
      setFeedMaxPages(s.feedMaxPages ?? 10);
      setFeedPrefetchPages(s.feedPrefetchPages ?? 6);
      setVipPrice3Months(s.vipPrice3Months);
      setVipPrice6Months(s.vipPrice6Months);
      setIncognitoIconSvg(s.incognitoIconSvg || '');
      setGalleryHombreImg(s.galleryHombreImg || '');
      setGalleryMujerImg(s.galleryMujerImg || '');
      setGalleryParejaImg(s.galleryParejaImg || '');
      setGalleryParejaHombresImg(s.galleryParejaHombresImg || '');
      setGalleryParejaMujeresImg(s.galleryParejaMujeresImg || '');
      setGalleryTransImg(s.galleryTransImg || '');
      setCoinPack1Coins(s.coinPack1Coins || '1000');
      setCoinPack1Price(s.coinPack1Price || '');
      setCoinPack2Coins(s.coinPack2Coins || '2000');
      setCoinPack2Price(s.coinPack2Price || '');
      setCoinPack3Coins(s.coinPack3Coins || '3000');
      setCoinPack3Price(s.coinPack3Price || '');
      setPaymentTitleVip(s.paymentTitleVip || 'Servicios Digitales');
      setPaymentDescriptorVip(s.paymentDescriptorVip || 'UNICOAPPS');
      setPaymentTitleCoins(s.paymentTitleCoins || 'Servicios Digitales');
      setPaymentDescriptorCoins(s.paymentDescriptorCoins || 'UNICOAPPS');
      setPaymentGateway(s.paymentGateway || 'mercadopago');
      setNavBottomPadding(s.navBottomPadding ?? 24);
      setNavSidePadding(s.navSidePadding ?? 16);
      setNavHeight(s.navHeight ?? 71);
      setNavOpacity(s.navOpacity ?? 40);
      setNavBlur(s.navBlur ?? 24);
      setStoryCirclePresetSmall(s.storyCirclePresetSmall ?? 72);
      setStoryCirclePresetMedium(s.storyCirclePresetMedium ?? s.storyCircleSize ?? 88);
      setStoryCirclePresetLarge(s.storyCirclePresetLarge ?? 104);
      setStoryCirclePresetXl(s.storyCirclePresetXl ?? s.sidebarAvatarSize ?? 154);
      setStoryCircleGap(s.storyCircleGap ?? 8);
      setStoryCircleBorder(s.storyCircleBorder ?? 4);
      setStoryCircleInnerGap(s.storyCircleInnerGap ?? 3);
      setHomeStoryCountMobile(s.homeStoryCountMobile ?? 15);
      setHomeStoryCountDesktop(s.homeStoryCountDesktop ?? 30);
      setSidebarStoryRingWidth(s.sidebarStoryRingWidth ?? s.storyCircleBorder ?? 4);
      setVideoGradientHeight(s.videoGradientHeight ?? 64);
      setVideoGradientOpacity(s.videoGradientOpacity ?? 40);
      setVideoAvatarSize(s.videoAvatarSize ?? 52);
      setStoryMaxDurationSeconds(String(s.storyMaxDurationSeconds ?? 15));
      setEncoderThreads(String(s.encoderThreads ?? 4));
      setEncoderCrf(s.encoderCrf || '29');
      setEncoderMaxrate(s.encoderMaxrate || '2700k');
      setEncoderBufsize(s.encoderBufsize || '8000k');
      setEncoderAudioBitrate(s.encoderAudioBitrate || '64k');
      setEncoderAudioMono(s.encoderAudioMono ?? true);
      setEncoderPreset(s.encoderPreset || 'superfast');
      setEncoderShowProgressHud(s.encoderShowProgressHud === true);
      // Propagate to global context so dependent components update live
      setSiteSettings(s);
      setSaved(true);
      setSaveError('');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error guardando settings:', err);
      setSaveError(err?.message || 'Error al guardar');
      setTimeout(() => setSaveError(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  const activeSection = searchParams.get('section') || 'fotos';
  const sectionMeta = ADMIN_SECTIONS.find(s => s.key === activeSection) || ADMIN_SECTIONS[0];

  useEffect(() => {
    if (mediaAutoTimerRef.current) {
      window.clearTimeout(mediaAutoTimerRef.current);
      mediaAutoTimerRef.current = null;
    }
    lastMediaAutoKeyRef.current = '';
    return undefined;
  }, [activeSection, debugPanelPrefs?.media, searchParams]);

  const ToggleSwitch = ({ value, onChange }) => (
    <button
      onClick={() => onChange(!value)}
      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-mansion-gold' : 'bg-mansion-border'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );

  const Counter = ({ value, onChange, min = 0, max = 99, step = 1 }) => {
    const [draft, setDraft] = useState(null);
    const inputValue = draft !== null ? draft : String(value);
    const commit = (raw) => {
      setDraft(null);
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) return;
      onChange(Math.min(max, Math.max(min, n)));
    };
    return (
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - step))} className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center text-text-secondary hover:text-mansion-gold transition-colors text-lg font-bold">−</button>
        <input
          type="number"
          value={inputValue}
          min={min}
          max={max}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
          className="text-xl font-bold text-mansion-gold bg-transparent text-center w-16 focus:outline-none focus:ring-1 focus:ring-mansion-gold/40 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button onClick={() => onChange(Math.min(max, value + step))} className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center text-text-secondary hover:text-mansion-gold transition-colors text-lg font-bold">+</button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mansion-base flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-mansion-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mansion-base pb-24 lg:pb-8">
      {/* Header — shows active section name */}
      <div className="sticky top-0 z-30 bg-mansion-base/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors lg:hidden">
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </button>
          <div className="flex items-center gap-2">
            <sectionMeta.icon className="w-4 h-4 text-mansion-gold" />
            <div>
              <h1 className="text-lg font-semibold text-text-primary">{sectionMeta.label}</h1>
              <p className="text-[11px] text-text-dim">Configuración del sitio</p>
            </div>
          </div>
          <div className="ml-auto">
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-mansion-crimson/20 text-mansion-crimson border border-mansion-crimson/30">Admin</span>
          </div>
        </div>
      </div>

      {/* Mobile section picker — horizontal scroll */}
      <div className="lg:hidden overflow-x-auto border-b border-white/5 bg-mansion-base/50 backdrop-blur">
        <div className="flex px-3 py-2 gap-1 min-w-max">
          {ADMIN_SECTIONS.map(s => {
            const Icon = s.icon;
            const isActive = activeSection === s.key;
            return (
              <button
                key={s.key}
                onClick={() => navigate(`/admin/configuracion?section=${s.key}`, { replace: true })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive ? 'bg-mansion-gold/10 text-mansion-gold border border-mansion-gold/20' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-8">

        {/* ── FOTOS & BLUR ── */}
        {activeSection === 'fotos' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Image className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Fotos & Blur</h2>
          </div>
          <div className="space-y-3">
            {/* Blur Mobile */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Blur Mobile</h3>
                  <p className="text-[11px] text-text-dim">Desenfoque en dispositivos móviles</p>
                </div>
              </div>
              <input type="range" min="0" max="30" value={blurMobile} onChange={e => setBlurMobile(Number(e.target.value))} className="w-full accent-mansion-gold" />
              <div className="flex justify-between text-[11px] text-text-dim mt-1">
                <span>Sin blur</span>
                <span className="text-mansion-gold font-medium">{blurMobile}px</span>
                <span>Máximo</span>
              </div>
            </div>

            {/* Blur Desktop */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Blur Desktop</h3>
                  <p className="text-[11px] text-text-dim">Desenfoque en computadoras</p>
                </div>
              </div>
              <input type="range" min="0" max="30" value={blurDesktop} onChange={e => setBlurDesktop(Number(e.target.value))} className="w-full accent-mansion-gold" />
              <div className="flex justify-between text-[11px] text-text-dim mt-1">
                <span>Sin blur</span>
                <span className="text-mansion-gold font-medium">{blurDesktop}px</span>
                <span>Máximo</span>
              </div>
            </div>

            {/* Free Visible Photos (Others) */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Image className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Fotos visibles (otros)</h3>
                    <p className="text-[11px] text-text-dim">Fotos sin blur por perfil ajeno</p>
                  </div>
                </div>
                <Counter value={freeVisiblePhotos} onChange={setFreeVisiblePhotos} max={20} />
              </div>
            </div>


          </div>
        </section>}

        {/* ── MENSAJERÍA ── */}
        {activeSection === 'mensajeria' && <section>
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Mensajería</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Mensajes diarios (free)</h3>
                    <p className="text-[11px] text-text-dim">Límite para usuarios no VIP</p>
                  </div>
                </div>
                <Counter value={dailyMessageLimit} onChange={setDailyMessageLimit} min={1} max={50} />
              </div>
            </div>

            {/* Online threshold */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Activity className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Umbral de estado online</h3>
                    <p className="text-[11px] text-text-dim">Minutos de inactividad para considerarse offline</p>
                  </div>
                </div>
                <Counter value={onlineThresholdMinutes} onChange={setOnlineThresholdMinutes} min={5} max={1440} />
              </div>
            </div>
          </div>
        </section>}

        {/* ── VIP & MONETIZACIÓN ── */}
        {activeSection === 'vip' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">VIP & Monetización</h2>
          </div>
          <div className="space-y-3">
            {/* Show VIP Button */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Crown className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Botón "Hazte VIP"</h3>
                    <p className="text-[11px] text-text-dim">Mostrar opciones de suscripción</p>
                  </div>
                </div>
                <ToggleSwitch value={showVipButton} onChange={setShowVipButton} />
              </div>
            </div>

            {/* VIP Prices */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5 space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Precios VIP</h3>
                  <p className="text-[11px] text-text-dim">Valores de suscripción (moneda local)</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">1 Mes</label>
                  <input type="text" value={vipPriceMonthly} onChange={e => setVipPriceMonthly(e.target.value)} placeholder="$4.990" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">3 Meses</label>
                  <input type="text" value={vipPrice3Months} onChange={e => setVipPrice3Months(e.target.value)} placeholder="$11.990" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">6 Meses</label>
                  <input type="text" value={vipPrice6Months} onChange={e => setVipPrice6Months(e.target.value)} placeholder="$19.990" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
              </div>
            </div>

            {/* Coin Packs */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5 space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Paquetes de Monedas</h3>
                  <p className="text-[11px] text-text-dim">Cantidad de monedas y precio de cada paquete</p>
                </div>
              </div>
              {[
                { label: 'Pack 1', coins: coinPack1Coins, setCoins: setCoinPack1Coins, price: coinPack1Price, setPrice: setCoinPack1Price },
                { label: 'Pack 2', coins: coinPack2Coins, setCoins: setCoinPack2Coins, price: coinPack2Price, setPrice: setCoinPack2Price },
                { label: 'Pack 3', coins: coinPack3Coins, setCoins: setCoinPack3Coins, price: coinPack3Price, setPrice: setCoinPack3Price },
              ].map(pk => (
                <div key={pk.label} className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">{pk.label}</label>
                  </div>
                  <div>
                    <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">Monedas</label>
                    <input type="text" value={pk.coins} onChange={e => pk.setCoins(e.target.value)} placeholder="1000" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">Precio $</label>
                    <input type="text" value={pk.price} onChange={e => pk.setPrice(e.target.value)} placeholder="999" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>}

        {/* ── PASARELA DE PAGOS ── */}
        {activeSection === 'pagos' && <section>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Pasarela de Pagos</h2>
          </div>
          <div className="space-y-3">
            {/* Payment Gateway Selector */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5 space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Gateway Activo</h3>
                  <p className="text-[11px] text-text-dim">Todos los pagos pasan por el bridge de UnicoApps</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'mercadopago', label: 'MercadoPago', desc: 'Vía Bridge' },
                  { value: 'uala_bis', label: 'Ualá Bis', desc: 'Vía Bridge' },
                ].map(gw => (
                  <button
                    key={gw.value}
                    onClick={() => setPaymentGateway(gw.value)}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                      paymentGateway === gw.value
                        ? 'border-mansion-gold bg-mansion-gold/10'
                        : 'border-white/10 bg-mansion-elevated hover:border-white/30'
                    }`}
                  >
                    <span className="font-bold text-sm text-text-primary">{gw.label}</span>
                    <span className="text-[10px] text-text-dim">{gw.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-text-dim">
                {paymentGateway === 'uala_bis'
                  ? 'Ualá Bis procesa el cobro a través del bridge. El merchant visible es UnicoApps.'
                  : 'MercadoPago procesa el cobro a través del bridge. El merchant visible es UnicoApps.'}
              </p>
            </div>

            {/* Payment Display — only for MercadoPago (Ualá uses checkout description from bridge) */}
            {paymentGateway === 'mercadopago' && (
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5 space-y-3">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Shield className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Datos del Pago (MercadoPago)</h3>
                  <p className="text-[11px] text-text-dim">Lo que ve el usuario en el checkout y su resumen de tarjeta</p>
                </div>
              </div>
              {/* VIP */}
              <p className="text-[10px] text-mansion-gold font-semibold uppercase tracking-wider">Suscripción VIP</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">Título del pago</label>
                  <input type="text" value={paymentTitleVip} onChange={e => setPaymentTitleVip(e.target.value)} placeholder="Servicios Digitales" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">Descriptor tarjeta</label>
                  <input type="text" value={paymentDescriptorVip} onChange={e => setPaymentDescriptorVip(e.target.value)} placeholder="UNICOAPPS" maxLength={22} className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
              </div>
              {/* Coins */}
              <p className="text-[10px] text-mansion-gold font-semibold uppercase tracking-wider mt-2">Compra de Monedas</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">Título del pago</label>
                  <input type="text" value={paymentTitleCoins} onChange={e => setPaymentTitleCoins(e.target.value)} placeholder="Servicios Digitales" className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
                <div>
                  <label className="text-[10px] text-text-dim uppercase tracking-wider mb-1 block">Descriptor tarjeta</label>
                  <input type="text" value={paymentDescriptorCoins} onChange={e => setPaymentDescriptorCoins(e.target.value)} placeholder="UNICOAPPS" maxLength={22} className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary" />
                </div>
              </div>
              <p className="text-[10px] text-text-dim">El descriptor aparece en el resumen de la tarjeta (máx. 22 caracteres)</p>
            </div>
            )}
          </div>
        </section>}

        {/* ── ICONOGRAFÍA ── */}
        {activeSection === 'iconografia' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Smile className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Iconografía</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Smile className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Ícono Modo Incógnito</h3>
                  <p className="text-[11px] text-text-dim">Sube un archivo .svg. Vacío = antifaz por defecto.</p>
                </div>
              </div>

              {/* Upload zone */}
              <label className="flex flex-col items-center justify-center gap-2 w-full h-24 rounded-xl border-2 border-dashed border-mansion-border/40 hover:border-mansion-gold/40 cursor-pointer transition-colors bg-mansion-elevated/50">
                <Smile className="w-5 h-5 text-text-dim" />
                <span className="text-[11px] text-text-dim">
                  {incognitoIconSvg.trim() ? 'Haz clic para reemplazar el SVG' : 'Haz clic para subir un archivo .svg'}
                </span>
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setIncognitoIconSvg(ev.target.result);
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </label>

              {/* Preview */}
              <div className="mt-3 flex items-center gap-4">
                <span className="text-[11px] text-text-dim">Vista previa:</span>
                <div className="w-10 h-10 rounded-xl bg-mansion-elevated flex items-center justify-center text-white">
                  {incognitoIconSvg.trim()
                    ? <span className="w-6 h-6" dangerouslySetInnerHTML={{ __html: incognitoIconSvg }} />
                    : <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12c0-3.3 2.4-5.5 5.5-5.5 1.6 0 2.8.8 3.5 1.9.7-1.1 1.9-1.9 3.5-1.9C18.6 6.5 21 8.7 21 12c0 2.5-1.8 5-4.5 5-1.6 0-2.8-.8-3.5-1.9-.7 1.1-1.9 1.9-3.5 1.9C6.8 17 3 14.5 3 12z" />
                        <circle cx="9" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
                        <circle cx="15" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
                      </svg>
                  }
                </div>
                {incognitoIconSvg.trim() && (
                  <button onClick={() => setIncognitoIconSvg('')} className="text-[11px] text-mansion-crimson hover:underline">Restaurar default</button>
                )}
              </div>
            </div>

            {/* Gallery Role Images */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Image className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Íconos de Galería</h3>
                  <p className="text-[11px] text-text-dim">Íconos pequeños para las tarjetas de galería. PNG/WebP recomendado.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Hombre', value: galleryHombreImg, setter: setGalleryHombreImg, color: '#3B82F6' },
                  { label: 'Mujer', value: galleryMujerImg, setter: setGalleryMujerImg, color: '#EC4899' },
                  { label: 'Pareja', value: galleryParejaImg, setter: setGalleryParejaImg, color: '#8B5CF6' },
                  { label: 'Pareja Hombres', value: galleryParejaHombresImg, setter: setGalleryParejaHombresImg, color: '#60A5FA' },
                  { label: 'Pareja Mujeres', value: galleryParejaMujeresImg, setter: setGalleryParejaMujeresImg, color: '#F472B6' },
                  { label: 'Trans', value: galleryTransImg, setter: setGalleryTransImg, color: '#2DD4BF' },
                ].map(({ label, value, setter, color }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <span className="text-[11px] font-medium" style={{ color }}>{label}</span>
                    <label className="relative w-full aspect-square rounded-xl border-2 border-dashed border-mansion-border/40 hover:border-mansion-gold/40 cursor-pointer transition-colors bg-mansion-elevated/50 overflow-hidden flex items-center justify-center">
                      {value ? (
                        <img src={value} alt={label} className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-5 h-5 text-text-dim" />
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const result = await uploadImage(file);
                            if (result.url) setter(result.url);
                          } catch (err) {
                            console.error('Error uploading gallery icon:', err);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {value && (
                      <button onClick={() => setter('')} className="text-[10px] text-mansion-crimson hover:underline">Quitar</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Registration Role Images */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Users className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Imágenes de Registro</h3>
                  <p className="text-[11px] text-text-dim">Imágenes para Hombre, Mujer y Pareja en el registro. PNG/JPG/WebP recomendado.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: 'Hombre', value: roleHombreImg, setter: setRoleHombreImg, color: '#3B82F6' },
                  { label: 'Mujer', value: roleMujerImg, setter: setRoleMujerImg, color: '#EC4899' },
                  { label: 'Pareja', value: roleParejaImg, setter: setRoleParejaImg, color: '#8B5CF6' },
                  { label: 'Pareja Hombres', value: roleParejaHombresImg, setter: setRoleParejaHombresImg, color: '#60A5FA' },
                  { label: 'Pareja Mujeres', value: roleParejaMujeresImg, setter: setRoleParejaMujeresImg, color: '#F472B6' },
                  { label: 'Trans', value: roleTransImg, setter: setRoleTransImg, color: '#2DD4BF' },
                ].map(({ label, value, setter, color }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <span className="text-[11px] font-medium" style={{ color }}>{label}</span>
                    <label className="relative w-full aspect-square rounded-xl border-2 border-dashed border-mansion-border/40 hover:border-mansion-gold/40 cursor-pointer transition-colors bg-mansion-elevated/50 overflow-hidden flex items-center justify-center">
                      {value ? (
                        <img src={value} alt={label} className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-5 h-5 text-text-dim" />
                      )}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const result = await uploadImage(file);
                            if (result.url) setter(result.url);
                          } catch (err) {
                            console.error('Error uploading role image:', err);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    {value && (
                      <button onClick={() => setter('')} className="text-[10px] text-mansion-crimson hover:underline">Quitar</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>}

        {/* ── SITIO ── */}
        {activeSection === 'sitio' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Sitio</h2>
          </div>
          <div className="space-y-3">
            {/* Country */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Globe className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">País del sitio</h3>
                    <p className="text-[11px] text-text-dim">Código ISO (AR, CL, MX, CO...)</p>
                  </div>
                </div>
                <input type="text" value={siteCountry} onChange={e => setSiteCountry(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="w-16 text-center text-sm py-2 px-2 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-mansion-gold font-bold uppercase" />
              </div>
            </div>

            {/* Allowed Countries */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Globe className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Países permitidos</h3>
                  <p className="text-[11px] text-text-dim">Códigos ISO separados por comas (AR,CL,MX...). Si el país detectado no está en la lista, se muestra un selector al registrarse.</p>
                </div>
              </div>
              <input
                type="text"
                value={allowedCountries}
                onChange={e => setAllowedCountries(e.target.value.toUpperCase())}
                placeholder="AR,CL,MX"
                className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-mansion-gold font-mono"
              />
            </div>

            {/* Hide Password */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Lock className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Ocultar contraseña</h3>
                    <p className="text-[11px] text-text-dim">Ojito cerrado por defecto en registro</p>
                  </div>
                </div>
                <ToggleSwitch value={hidePasswordRegister} onChange={setHidePasswordRegister} />
              </div>
            </div>

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Activity className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Scoring del feed</h3>
                    <p className="text-[11px] text-text-dim">Ajusta cuánto pesa cada señal en el orden del feed principal.</p>
                  </div>
                </div>
                <ToggleSwitch value={feedFilterByCountry} onChange={setFeedFilterByCountry} />
              </div>

              <div className="rounded-xl border border-white/5 bg-mansion-elevated/30 px-3 py-2 text-[11px] text-text-dim">
                Filtro por país en el feed:
                <span className="ml-2 font-semibold text-mansion-gold">{feedFilterByCountry ? 'Activo' : 'Desactivado'}</span>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { label: 'Actividad reciente', value: feedWeightLastActive, setter: setFeedWeightLastActive, hint: 'Empuja usuarios activos recientemente.' },
                  { label: 'Story activa', value: feedWeightStory, setter: setFeedWeightStory, hint: 'Premia perfiles que están transmitiendo.' },
                  { label: 'Cantidad de fotos', value: feedWeightPhotos, setter: setFeedWeightPhotos, hint: 'Sube perfiles con más contenido cargado.' },
                  { label: 'Seguidores', value: feedWeightFollowers, setter: setFeedWeightFollowers, hint: 'Da peso social a perfiles fuertes.' },
                  { label: 'Intereses compartidos', value: feedWeightSharedInterests, setter: setFeedWeightSharedInterests, hint: 'Aumenta afinidad por gustos similares.' },
                  { label: 'Premium', value: feedWeightPremium, setter: setFeedWeightPremium, hint: 'Da un plus a perfiles VIP.' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/5 bg-mansion-elevated/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                        <p className="text-[11px] text-text-dim">{item.hint}</p>
                      </div>
                      <Counter value={item.value} onChange={item.setter} min={0} max={100} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-text-primary mb-1">Paginación del feed (Desktop)</h3>
                <p className="text-[11px] text-text-dim mb-3">Controla la paginación del feed en escritorio. Las cards totales accesibles = cards × páginas.</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/5 bg-mansion-elevated/40 p-3 flex flex-col gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Cards por página</p>
                      <p className="text-[11px] text-text-dim">Perfiles visibles en cada página.</p>
                    </div>
                    <div className="flex justify-end">
                      <Counter value={feedCardsPerPage} onChange={setFeedCardsPerPage} min={6} max={60} step={6} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-mansion-elevated/40 p-3 flex flex-col gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Máx páginas</p>
                      <p className="text-[11px] text-text-dim">Páginas navegables — {feedCardsPerPage * feedMaxPages} cards máx.</p>
                    </div>
                    <div className="flex justify-end">
                      <Counter value={feedMaxPages} onChange={setFeedMaxPages} min={1} max={50} step={1} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-mansion-elevated/40 p-3 flex flex-col gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Precarga</p>
                      <p className="text-[11px] text-text-dim">Páginas por request — {feedCardsPerPage * feedPrefetchPages} profiles/query.</p>
                    </div>
                    <div className="flex justify-end">
                      <Counter value={feedPrefetchPages} onChange={setFeedPrefetchPages} min={1} max={20} step={1} />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>}

        {/* ── CATÁLOGO DE REGALOS ── */}
        {activeSection === 'regalos' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Catálogo de Regalos</h2>
          </div>
          <div className="space-y-3">
            {/* Add new gift */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Agregar regalo</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input
                  value={newGiftEmoji}
                  onChange={(e) => setNewGiftEmoji(e.target.value)}
                  placeholder="Emoji"
                  className="px-3 py-2 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary text-sm focus:border-mansion-gold/50 focus:outline-none"
                />
                <input
                  value={newGiftName}
                  onChange={(e) => setNewGiftName(e.target.value)}
                  placeholder="Nombre"
                  className="px-3 py-2 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary text-sm focus:border-mansion-gold/50 focus:outline-none"
                />
                <input
                  type="number"
                  value={newGiftPrice}
                  onChange={(e) => setNewGiftPrice(e.target.value)}
                  placeholder="Precio (monedas)"
                  className="px-3 py-2 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary text-sm focus:border-mansion-gold/50 focus:outline-none"
                />
                <select
                  value={newGiftCategory}
                  onChange={(e) => setNewGiftCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary text-sm focus:border-mansion-gold/50 focus:outline-none"
                >
                  <option value="general">General</option>
                  <option value="romántico">Romántico</option>
                  <option value="lujo">Lujo</option>
                  <option value="pasión">Pasión</option>
                </select>
              </div>
              <button
                onClick={async () => {
                  if (!newGiftEmoji || !newGiftName || !newGiftPrice) return;
                  try {
                    const data = await adminCreateGift({ name: newGiftName, emoji: newGiftEmoji, price: Number(newGiftPrice), category: newGiftCategory });
                    setGifts(data.gifts || []);
                    setNewGiftEmoji('');
                    setNewGiftName('');
                    setNewGiftPrice('');
                    setNewGiftCategory('general');
                  } catch { /* Silently fail */ }
                }}
                className="w-full py-2 rounded-xl bg-mansion-gold/20 text-mansion-gold text-sm font-semibold hover:bg-mansion-gold/30 transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>

            {/* Gift list */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Regalos activos</h3>
              <div className="space-y-2">
                {gifts.filter(g => g.active).map((g) => (
                  <div key={g.id} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-mansion-elevated/50">
                    <span className="text-xl">{g.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{g.name}</p>
                      <p className="text-[10px] text-text-dim">{g.category} · {g.price} monedas</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const data = await adminDeleteGift(g.id);
                          setGifts(data.gifts || []);
                        } catch { /* Silently fail */ }
                      }}
                      className="p-1.5 rounded-lg hover:bg-mansion-crimson/10 text-text-dim hover:text-mansion-crimson transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {gifts.filter(g => g.active).length === 0 && (
                  <p className="text-xs text-text-dim text-center py-4">No hay regalos en el catálogo</p>
                )}
              </div>
            </div>
          </div>
        </section>}

        {/* ── DEBUG ── */}
        {activeSection === 'debug' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-red-400" />
            <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider">Debug / Zona peligrosa</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-mansion-card rounded-2xl p-4 border border-cyan-500/20 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Boot diagnostics para PWA</h3>
                <p className="text-[11px] text-text-dim">Guarda estos flags localmente para poder probar el arranque desde mobile/PWA sin depender de la URL. Los cambios pegan al recargar.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Boot shield</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{bootDebugFlags.bootShield ? 'activo' : 'apagado'}</p>
                </div>
                <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Skip bootstrap</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{bootDebugFlags.skipBootstrap ? 'activo' : 'apagado'}</p>
                </div>
                <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2 col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Solo shell oscuro</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{bootDebugFlags.shellOnly ? 'activo' : 'apagado'}</p>
                </div>
                <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2 col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Forzar black test al abrir</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{bootDebugFlags.forceBlackTest ? 'activo' : 'apagado'}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyBootDebugFlags({ ...bootDebugFlags, bootShield: !bootDebugFlags.bootShield })}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    bootDebugFlags.bootShield
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                      : 'bg-mansion-card border border-mansion-border/40 text-text-muted hover:text-text-primary'
                  }`}
                >
                  Fondo al arrancar: {bootDebugFlags.bootShield ? 'on' : 'off'}
                </button>
                <button
                  onClick={() => applyBootDebugFlags({ ...bootDebugFlags, skipBootstrap: !bootDebugFlags.skipBootstrap })}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    bootDebugFlags.skipBootstrap
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                      : 'bg-mansion-card border border-mansion-border/40 text-text-muted hover:text-text-primary'
                  }`}
                >
                  Saltar bootstrap: {bootDebugFlags.skipBootstrap ? 'on' : 'off'}
                </button>
                <button
                  onClick={() => applyBootDebugFlags({ ...bootDebugFlags, shellOnly: !bootDebugFlags.shellOnly })}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    bootDebugFlags.shellOnly
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                      : 'bg-mansion-card border border-mansion-border/40 text-text-muted hover:text-text-primary'
                  }`}
                >
                  Solo shell oscuro: {bootDebugFlags.shellOnly ? 'on' : 'off'}
                </button>
                <button
                  onClick={() => applyBootDebugFlags({ ...bootDebugFlags, forceBlackTest: !bootDebugFlags.forceBlackTest })}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    bootDebugFlags.forceBlackTest
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                      : 'bg-mansion-card border border-mansion-border/40 text-text-muted hover:text-text-primary'
                  }`}
                >
                  Abrir en black test: {bootDebugFlags.forceBlackTest ? 'on' : 'off'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => applyBootDebugFlags({ bootShield: false, skipBootstrap: false, shellOnly: true }, false)}
                  className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-semibold hover:text-cyan-200 transition-colors"
                >
                  Activar shell ahora
                </button>
                <button
                  onClick={() => applyBootDebugFlags(bootDebugFlags, true)}
                  className="px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm font-semibold hover:text-cyan-200 transition-colors"
                >
                  Aplicar y recargar
                </button>
                <button
                  onClick={() => applyBootDebugFlags({ bootShield: true, skipBootstrap: false }, true)}
                  className="px-4 py-2 rounded-xl bg-mansion-card border border-mansion-border/40 text-text-muted text-sm font-semibold hover:text-text-primary transition-colors"
                >
                  Probar solo fondo
                </button>
                <button
                  onClick={() => applyBootDebugFlags({ bootShield: false, skipBootstrap: true }, true)}
                  className="px-4 py-2 rounded-xl bg-mansion-card border border-mansion-border/40 text-text-muted text-sm font-semibold hover:text-text-primary transition-colors"
                >
                  Probar sin bootstrap
                </button>
                <button
                  onClick={() => applyBootDebugFlags({ bootShield: true, skipBootstrap: true }, true)}
                  className="px-4 py-2 rounded-xl bg-mansion-card border border-mansion-border/40 text-text-muted text-sm font-semibold hover:text-text-primary transition-colors"
                >
                  Probar ambos
                </button>
                <button
                  onClick={() => applyBootDebugFlags({ bootShield: false, skipBootstrap: false, shellOnly: true }, true)}
                  className="px-4 py-2 rounded-xl bg-mansion-card border border-mansion-border/40 text-text-muted text-sm font-semibold hover:text-text-primary transition-colors"
                >
                  Probar solo shell
                </button>
                <button
                  onClick={() => applyBootDebugFlags({ bootShield: false, skipBootstrap: false, shellOnly: false, forceBlackTest: true }, true)}
                  className="px-4 py-2 rounded-xl bg-mansion-card border border-mansion-border/40 text-text-muted text-sm font-semibold hover:text-text-primary transition-colors"
                >
                  Abrir PWA en black test
                </button>
                <button
                  onClick={clearBootDebugAndReload}
                  className="px-4 py-2 rounded-xl bg-mansion-crimson/10 border border-mansion-crimson/20 text-mansion-crimson text-sm font-semibold hover:text-red-300 transition-colors"
                >
                  Limpiar y recargar normal
                </button>
                <button
                  onClick={unregisterServiceWorkersAndReload}
                  disabled={swResetting}
                  className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-semibold hover:text-amber-200 transition-colors disabled:opacity-60"
                >
                  {swResetting ? 'Limpiando PWA...' : 'Borrar service worker y recargar'}
                </button>
              </div>
              {swResetStatus ? (
                <p className="text-[11px] text-amber-200/80">{swResetStatus}</p>
              ) : null}
            </div>
            <div className="bg-mansion-card rounded-2xl p-4 border border-mansion-border/20 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Bloques visibles del debug</h3>
                <p className="text-[11px] text-text-dim">Puedes mostrar u ocultar cada bloque por separado en el overlay para que no ocupe toda la pantalla.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ['api', 'API requests'],
                  ['realtime', 'WebSockets'],
                  ['media', 'HIT / MISS media'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDebugPanelPrefs(setDebugPanelPref(key, !debugPanelPrefs?.[key]))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      debugPanelPrefs?.[key]
                        ? 'bg-mansion-gold/20 border border-mansion-gold/30 text-mansion-gold'
                        : 'bg-mansion-card border border-mansion-border/40 text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {label}: {debugPanelPrefs?.[key] ? 'on' : 'off'}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-mansion-card rounded-2xl p-4 border border-mansion-gold/20 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">API Debug Overlay</h3>
                  <p className="text-[11px] text-text-dim">Activa el panel de requests sin usar consola. Tambien puedes abrirlo con <span className="text-text-primary">?api_debug=1</span>.</p>
                </div>
                <button
                  onClick={() => setApiDebugSummary(setApiDebugEnabled(!apiDebugSummary?.enabled))}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    apiDebugSummary?.enabled
                      ? 'bg-mansion-gold/20 border border-mansion-gold/30 text-mansion-gold'
                      : 'bg-mansion-card border border-mansion-border/40 text-text-muted hover:text-text-primary'
                  }`}
                >
                  {apiDebugSummary?.enabled ? 'Activo' : 'Inactivo'}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Ruta actual</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{apiDebugSummary?.totalRequests ?? 0}</p>
                </div>
                <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Sesion total</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{apiDebugSummary?.sessionTotalRequests ?? 0}</p>
                </div>
                <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Endpoints ruta</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{apiDebugSummary?.counts?.length ?? 0}</p>
                </div>
                <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Endpoints sesion</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{apiDebugSummary?.sessionCounts?.length ?? 0}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setApiDebugSummary(resetApiDebugRoute())}
                  className="px-4 py-2 rounded-xl bg-mansion-card border border-mansion-border/40 text-text-muted text-sm font-semibold hover:text-text-primary transition-colors"
                >
                  Reset ruta actual
                </button>
                <button
                  onClick={() => setApiDebugSummary(resetApiDebugSession())}
                  className="px-4 py-2 rounded-xl bg-mansion-card border border-mansion-border/40 text-text-muted text-sm font-semibold hover:text-text-primary transition-colors"
                >
                  Reset sesion
                </button>
              </div>

              <div className="rounded-xl border border-mansion-border/20 overflow-hidden">
                <div className="px-3 py-2 border-b border-mansion-border/20 bg-mansion-base/60">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Top endpoints de la ruta actual</p>
                  <p className="text-xs text-text-muted truncate">{apiDebugSummary?.currentRoute || 'sin ruta'}</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {(apiDebugSummary?.counts || []).length === 0 ? (
                    <p className="px-3 py-4 text-xs text-text-dim">Aun no hay requests registrados en esta ruta.</p>
                  ) : (
                    (apiDebugSummary?.counts || []).map((row) => (
                      <div key={row.key} className="px-3 py-2 border-b border-mansion-border/20 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs text-text-primary break-all">{row.key}</p>
                          <span className="shrink-0 rounded-full bg-mansion-gold/15 border border-mansion-gold/20 px-2 py-0.5 text-[10px] font-semibold text-mansion-gold">
                            {row.count}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-text-dim">avg {row.avgMs}ms · ok {row.ok} · err {row.errors} · status {row.lastStatus ?? '-'}</p>
                        {row.lastTiming && (
                          <p className="mt-1 text-[10px] text-cyan-300 break-all">
                            timing: {row.lastTiming}
                          </p>
                        )}
                        {row.lastCache && (
                          <p className="mt-1 text-[10px] text-emerald-300 break-all">
                            cache: {row.lastCache}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="bg-mansion-card rounded-2xl p-4 border border-emerald-500/20 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Media Cache Debug</h3>
                  <p className="text-[11px] text-text-dim">Inspeccion manual de las imagenes y videos visibles. Muestra HIT, REVALIDATED y MISS sin dispararse automaticamente al entrar en debug.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      lastMediaAutoKeyRef.current = '';
                      setMediaDebugSummary(resetMediaDebug());
                    }}
                    className="px-4 py-2 rounded-xl bg-mansion-card border border-mansion-border/40 text-text-muted text-sm font-semibold hover:text-text-primary transition-colors"
                  >
                    Reset media
                  </button>
                  <button
                    onClick={async () => {
                      setMediaDebugSummary(prev => ({ ...(prev || {}), loading: true }));
                      const next = await inspectVisibleMedia({ limit: 24 });
                      lastMediaAutoKeyRef.current = `${window.location.pathname}${window.location.search}::${activeSection}`;
                      setMediaDebugSummary(next);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm font-semibold hover:text-emerald-200 transition-colors"
                  >
                    {mediaDebugSummary?.loading ? 'Midiendo...' : 'Actualizar ahora'}
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-text-dim">Ruta actual</p>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-dim">Total</p>
                    <p className="mt-1 text-lg font-semibold text-text-primary">{mediaDebugSummary?.summary?.total ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300/70">HIT</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-200">{mediaDebugSummary?.summary?.hit ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-sky-300/70">REVAL</p>
                    <p className="mt-1 text-lg font-semibold text-sky-200">{mediaDebugSummary?.summary?.revalidated ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/70">MISS</p>
                    <p className="mt-1 text-lg font-semibold text-amber-200">{mediaDebugSummary?.summary?.miss ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-mansion-border/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-dim">Other</p>
                    <p className="mt-1 text-lg font-semibold text-text-primary">{mediaDebugSummary?.summary?.other ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-rose-300/70">Errors</p>
                    <p className="mt-1 text-lg font-semibold text-rose-200">{mediaDebugSummary?.summary?.errors ?? 0}</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-text-dim">Sesion</p>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div className="rounded-xl bg-mansion-base/60 border border-mansion-border/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-dim">Total</p>
                    <p className="mt-1 text-lg font-semibold text-text-primary">{mediaDebugSummary?.sessionSummary?.total ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300/70">HIT</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-200">{mediaDebugSummary?.sessionSummary?.hit ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-sky-300/70">REVAL</p>
                    <p className="mt-1 text-lg font-semibold text-sky-200">{mediaDebugSummary?.sessionSummary?.revalidated ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/70">MISS</p>
                    <p className="mt-1 text-lg font-semibold text-amber-200">{mediaDebugSummary?.sessionSummary?.miss ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 border border-mansion-border/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-text-dim">Other</p>
                    <p className="mt-1 text-lg font-semibold text-text-primary">{mediaDebugSummary?.sessionSummary?.other ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-rose-300/70">Errors</p>
                    <p className="mt-1 text-lg font-semibold text-rose-200">{mediaDebugSummary?.sessionSummary?.errors ?? 0}</p>
                  </div>
                </div>
              </div>

              {mediaDebugSummary?.error ? (
                <p className="text-xs text-rose-300">{mediaDebugSummary.error}</p>
              ) : null}

              <div className="rounded-xl border border-mansion-border/20 overflow-hidden">
                <div className="px-3 py-2 border-b border-mansion-border/20 bg-mansion-base/60">
                  <p className="text-[10px] uppercase tracking-wider text-text-dim">Resultados de media visible</p>
                  <p className="text-xs text-text-muted truncate">{mediaDebugSummary?.route || 'sin ruta'}</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {(mediaDebugSummary?.entries || []).length === 0 ? (
                    <p className="px-3 py-4 text-xs text-text-dim">Todavia no se inspecciono media visible.</p>
                  ) : (
                    (mediaDebugSummary?.entries || []).map((entry) => (
                      <div key={entry.url} className="px-3 py-2 border-b border-mansion-border/20 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs text-text-primary break-all">{entry.url}</p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            entry.cacheStatus === 'HIT'
                              ? 'bg-emerald-500/15 border border-emerald-500/20 text-emerald-200'
                              : entry.cacheStatus === 'REVALIDATED'
                                ? 'bg-sky-500/15 border border-sky-500/20 text-sky-200'
                              : entry.cacheStatus === 'MISS'
                                ? 'bg-amber-500/15 border border-amber-500/20 text-amber-200'
                                : 'bg-mansion-border/20 border border-mansion-border/30 text-text-muted'
                          }`}>
                            {entry.cacheStatus || (entry.error ? 'ERR' : '-')}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-text-dim">
                          status {entry.status ?? '-'} · age {entry.age || '-'} · type {entry.contentType || '-'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="bg-mansion-card rounded-2xl p-4 border border-sky-500/20 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Realtime / WebSocket Debug</h3>
                  <p className="text-[11px] text-text-dim">Cuenta aperturas, cierres, reconnects, pings y mensajes de los sockets de notificaciones y chat. Esto no agrega requests extra; solo mide eventos locales. Ventana actual: {realtimeEstimate?.elapsedMinutes ?? 0} min.</p>
                  {realtimeEstimate?.sampleShort && (
                    <p className="mt-1 text-[11px] text-amber-300/85">Muestra corta: la estimacion por hora se estabiliza tras 1 min.</p>
                  )}
                </div>
                <button
                  onClick={() => setRealtimeDebugSummary(resetRealtimeDebug())}
                  className="px-4 py-2 rounded-xl bg-mansion-card border border-mansion-border/40 text-text-muted text-sm font-semibold hover:text-text-primary transition-colors"
                >
                  Reset realtime
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    key: 'notifications',
                    label: 'Notificaciones',
                    data: realtimeDebugSummary?.channels?.notifications,
                    estimate: realtimeEstimate?.channels?.notifications,
                  },
                  {
                    key: 'chat',
                    label: 'Chat',
                    data: realtimeDebugSummary?.channels?.chat,
                    estimate: realtimeEstimate?.channels?.chat,
                  },
                ].map(({ key, label, data, estimate }) => (
                  <div key={key} className="rounded-xl border border-mansion-border/20 overflow-hidden">
                    <div className="px-3 py-2 border-b border-mansion-border/20 bg-mansion-base/60 flex items-center justify-between">
                      <p className="text-xs font-semibold text-text-primary">{label}</p>
                      <span className="rounded-full bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                        activas {data?.activeConnections ?? 0}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3">
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Connects</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.connectAttempts ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Opens</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.opens ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Closes</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.closes ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Reconnects</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.reconnectsScheduled ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Pings</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.pingsSent ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Pongs</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.pongsReceived ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Msgs in</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.messagesReceived ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Msgs out</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.messagesSent ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Errores</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.errors ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-mansion-base/60 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-text-dim">Pausas bg</p>
                        <p className="mt-1 text-base font-semibold text-text-primary">{data?.backgroundPauses ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-sky-500/5 px-3 py-2 border border-sky-500/10">
                        <p className="text-[10px] uppercase tracking-wider text-sky-300/80">Upgrades/h</p>
                        <p className="mt-1 text-base font-semibold text-sky-200">{estimate?.upgradeReqPerHour ?? 0}</p>
                      </div>
                      <div className="rounded-lg bg-sky-500/5 px-3 py-2 border border-sky-500/10">
                        <p className="text-[10px] uppercase tracking-wider text-sky-300/80">DO eq/h</p>
                        <p className="mt-1 text-base font-semibold text-sky-200">{estimate?.approxDoEqReqPerHour ?? 0}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-mansion-card rounded-2xl p-4 border border-red-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Quitar VIP a todos</h3>
                  <p className="text-[11px] text-text-dim">Resetea premium y premium_until de todos los usuarios</p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('¿Seguro? Esto quitará VIP a TODOS los usuarios.')) return;
                    try {
                      const data = await adminRemoveAllVip();
                      alert(`VIP removido de ${data.affected} usuarios`);
                    } catch { alert('Error al quitar VIP'); }
                  }}
                  className="px-4 py-2 rounded-xl bg-red-900/30 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-900/50 transition-colors"
                >
                  Ejecutar
                </button>
              </div>
            </div>
            <div className="bg-mansion-card rounded-2xl p-4 border border-red-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Resetear monedas</h3>
                  <p className="text-[11px] text-text-dim">Pone a 0 las monedas de todos los usuarios</p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm('¿Seguro? Esto pondrá a 0 las monedas de TODOS los usuarios.')) return;
                    try {
                      const data = await adminResetAllCoins();
                      alert(`Monedas reseteadas en ${data.affected} usuarios`);
                    } catch { alert('Error al resetear monedas'); }
                  }}
                  className="px-4 py-2 rounded-xl bg-red-900/30 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-900/50 transition-colors"
                >
                  Ejecutar
                </button>
              </div>
            </div>
          </div>
        </section>}

        {/* Save button */}
        {activeSection === 'navegacion' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Navigation className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Barra de Navegación Inferior</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Navigation className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Geometría fija</h3>
                  <p className="text-[11px] text-text-dim">La barra inferior toma estos valores desde <code>bottomNavConfig.js</code>. Los valores guardados en la API no se usan para la geometría.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                <div className="rounded-xl bg-mansion-elevated/60 border border-white/5 p-3">
                  <div className="text-text-dim uppercase tracking-wider text-[10px] mb-1">Altura</div>
                  <div className="text-text-primary font-semibold">{BOTTOM_NAV_HEIGHT}px</div>
                </div>
                <div className="rounded-xl bg-mansion-elevated/60 border border-white/5 p-3">
                  <div className="text-text-dim uppercase tracking-wider text-[10px] mb-1">Offset visual</div>
                  <div className="text-text-primary font-semibold">{BOTTOM_NAV_VISUAL_OFFSET}px</div>
                </div>
                <div className="rounded-xl bg-mansion-elevated/60 border border-white/5 p-3">
                  <div className="text-text-dim uppercase tracking-wider text-[10px] mb-1">Extra página</div>
                  <div className="text-text-primary font-semibold">{BOTTOM_NAV_PAGE_EXTRA_PADDING}px</div>
                </div>
                <div className="rounded-xl bg-mansion-elevated/60 border border-white/5 p-3">
                  <div className="text-text-dim uppercase tracking-wider text-[10px] mb-1">Laterales</div>
                  <div className="text-text-primary font-semibold">{BOTTOM_NAV_SIDE_PADDING}px</div>
                </div>
                <div className="rounded-xl bg-mansion-elevated/60 border border-white/5 p-3">
                  <div className="text-text-dim uppercase tracking-wider text-[10px] mb-1">PWA</div>
                  <div className="text-text-primary font-semibold">{STANDALONE_BOTTOM_NAV_HEIGHT + STANDALONE_BOTTOM_NAV_VISUAL_OFFSET + STANDALONE_BOTTOM_NAV_PAGE_EXTRA_PADDING}px</div>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-text-dim">Para modificar la geometría, editar <code>src/lib/bottomNavConfig.js</code>. Home, secciones con <code>pb-mobile-legacy-nav</code>, videos y overlays comparten esa fuente.</p>
            </div>
          </div>
        </section>}

        {activeSection === 'stories' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Film className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Stories</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <h3 className="text-xs font-bold text-text-dim uppercase tracking-wider mb-3">Configuración de anillo</h3>
              <div className="rounded-xl bg-mansion-base/70 border border-white/5 p-4">
                <div className="flex gap-2 mb-4 flex-wrap">
                  {storyPresetOptions.map((option) => {
                    const active = option.key === storyPresetEditor;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setStoryPresetEditor(option.key)}
                        className={`min-w-[88px] flex-1 rounded-xl border px-3 py-2 text-left transition-colors ${active ? 'border-mansion-gold/40 bg-mansion-gold/10 text-text-primary' : 'border-white/5 bg-mansion-card/40 text-text-dim hover:border-white/10 hover:text-text-primary'}`}
                      >
                        <p className="text-xs font-semibold">{option.label}</p>
                        <p className="text-[10px] opacity-80">{option.size}px</p>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-center overflow-visible py-2">
                    <div className="relative shrink-0 rounded-full bg-gradient-to-tr from-mansion-gold via-mansion-crimson to-mansion-gold" style={{ width: activeStoryPreset.size, height: activeStoryPreset.size, aspectRatio: '1 / 1' }}>
                      <div className="absolute rounded-full bg-mansion-card" style={{ inset: `${activeStoryPresetBorder}%` }}>
                        <div className="h-full w-full rounded-full bg-mansion-base" style={{ padding: activeStoryPresetInnerGapPx }}>
                          <div className="flex h-full w-full items-center justify-center rounded-full overflow-hidden bg-gradient-to-br from-white/10 to-white/5 text-text-muted">
                            <User className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">Ajustes para {activeStoryPreset.label.toLowerCase()}</p>
                      <p className="text-[11px] text-text-dim">{activeStoryPreset.context}</p>
                    </div>
                    <label className="rounded-xl border border-white/5 bg-mansion-card/40 p-3">
                      <span className="mb-1 block text-[11px] text-text-dim">Avatar size</span>
                      <input
                        type="number"
                        min="40"
                        max="220"
                        value={avatarSizeDraft}
                        onChange={(e) => setAvatarSizeDraft(e.target.value)}
                        onBlur={commitAvatarSizeDraft}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-full rounded-lg border border-white/10 bg-mansion-base px-2 py-1.5 text-sm text-text-primary outline-none focus:border-mansion-gold/40"
                      />
                      <p className="mt-1 text-[10px] text-text-dim">Se aplica al preview al salir del campo.</p>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-1">
                      <div className="rounded-xl border border-white/5 bg-mansion-card/40 p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div>
                            <p className="text-xs font-semibold text-text-primary">Grosor del anillo (stories home)</p>
                            <p className="text-[10px] text-text-dim">Aplicado a los círculos de stories en el feed</p>
                          </div>
                          <span className="text-sm font-semibold text-mansion-gold">{storyCircleBorder}%</span>
                        </div>
                        <input type="range" min="1" max="18" value={storyCircleBorder} onChange={e => setStoryCircleBorder(Number(e.target.value))} className="w-full accent-mansion-gold" />
                        <div className="mt-1 flex justify-between text-[10px] text-text-dim">
                          <span>1%</span>
                          <span>18%</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-mansion-card/40 p-3">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div>
                            <p className="text-xs font-semibold text-text-primary">Grosor del anillo (sidebar desktop)</p>
                            <p className="text-[10px] text-text-dim">Independiente del grosor de la home</p>
                          </div>
                          <span className="text-sm font-semibold text-mansion-gold">{sidebarStoryRingWidth}%</span>
                        </div>
                        <input type="range" min="1" max="18" value={sidebarStoryRingWidth} onChange={e => setSidebarStoryRingWidth(Number(e.target.value))} className="w-full accent-mansion-gold" />
                        <div className="mt-1 flex justify-between text-[10px] text-text-dim">
                          <span>1%</span>
                          <span>18%</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-mansion-card/40 p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="text-xs font-semibold text-text-primary">Espacio interno</p>
                          <p className="text-[10px] text-text-dim">Separación negra entre anillo y foto</p>
                        </div>
                        <span className="text-sm font-semibold text-mansion-gold">{storyCircleInnerGap}%</span>
                      </div>
                      <input type="range" min="0" max="16" value={storyCircleInnerGap} onChange={e => setStoryCircleInnerGap(Number(e.target.value))} className="w-full accent-mansion-gold" />
                      <div className="mt-1 flex justify-between text-[10px] text-text-dim">
                        <span>0%</span>
                        <span>16%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/5 bg-mansion-card/50 p-2.5">
                        <p className="text-[10px] text-text-dim">Anillo</p>
                        <p className="text-sm font-semibold text-text-primary">{activeStoryPresetRingPx}px</p>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-mansion-card/50 p-2.5">
                        <p className="text-[10px] text-text-dim">Espacio interno</p>
                        <p className="text-sm font-semibold text-text-primary">{activeStoryPresetInnerGapPx}px</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-mansion-card/50 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-text-primary">Ajustes generales</h3>
                <p className="text-[11px] text-text-dim">La home toma el preset Stories y la sidebar desktop toma el preset Sidebar desktop.</p>
              </div>

              <div className="grid gap-3 mb-3 md:grid-cols-2">
                <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-mansion-gold" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">Stories visibles en mobile</h3>
                      <p className="text-[11px] text-text-dim">Máximo de círculos mostrados en la home móvil</p>
                    </div>
                  </div>
                  <Counter value={homeStoryCountMobile} onChange={setHomeStoryCountMobile} min={1} max={60} />
                </div>

                <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-mansion-gold" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">Stories visibles en desktop</h3>
                      <p className="text-[11px] text-text-dim">Máximo de círculos mostrados en la home desktop</p>
                    </div>
                  </div>
                  <Counter value={homeStoryCountDesktop} onChange={setHomeStoryCountDesktop} min={1} max={60} />
                </div>
              </div>

              <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                    <Navigation className="w-4 h-4 text-mansion-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Separación entre stories</h3>
                    <p className="text-[11px] text-text-dim">Valor global relativo al tamaño del avatar</p>
                  </div>
                </div>
                <input type="range" min="0" max="30" value={storyCircleGap} onChange={e => setStoryCircleGap(Number(e.target.value))} className="w-full accent-mansion-gold" />
                <div className="flex justify-between text-[11px] text-text-dim mt-1">
                  <span>0%</span>
                  <span className="text-mansion-gold font-medium">{storyCircleGap}%</span>
                  <span>30%</span>
                </div>
                <p className="mt-2 text-[11px] text-text-dim">Equivale a {storyCircleGapPx}px con un avatar de {storyCirclePresetMedium}px en Stories.</p>
              </div>
            </div>

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <h3 className="text-xs font-bold text-text-dim uppercase tracking-wider mb-3">Preview stories home</h3>
              <div className="rounded-xl bg-mansion-base/70 border border-white/5 p-4 overflow-hidden">
                <div className="mb-3 flex items-center gap-1.5">
                  <div className="h-3.5 w-3.5 rounded-full bg-mansion-crimson/80" />
                  <p className="text-xs font-medium text-text-dim">Transmitiendo</p>
                </div>
                <div className="flex overflow-hidden" style={{ gap: `${storyCircleGapPx}px` }}>
                  {[
                    { label: 'Tú', active: true, gold: true },
                    { label: 'Luna', active: true },
                    { label: 'Mia', active: false },
                  ].map((item) => (
                    <div key={item.label} className="flex shrink-0 flex-col items-center gap-1" style={{ width: storyCirclePresetMedium + 6 }}>
                      <div
                        className={`rounded-full ${item.gold ? 'bg-gradient-to-tr from-mansion-gold via-mansion-crimson to-mansion-gold' : item.active ? 'bg-gradient-to-tr from-mansion-crimson via-mansion-gold to-mansion-crimson' : 'bg-gradient-to-tr from-mansion-border/60 to-mansion-border/40'}`}
                        style={{ width: storyCirclePresetMedium, height: storyCirclePresetMedium, padding: storyCircleBorderPx }}
                      >
                        <div className="h-full w-full rounded-full bg-mansion-base" style={{ padding: storyCircleInnerGapPx }}>
                          <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-white/10 to-white/5 text-text-muted">
                            <User className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                      <span className={`w-full truncate text-center text-[10px] leading-tight ${item.gold ? 'text-mansion-gold' : 'text-text-muted'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-white/5 bg-mansion-card/50 p-2.5">
                    <p className="text-[10px] text-text-dim">Avatar</p>
                    <p className="text-sm font-semibold text-text-primary">{storyCirclePresetMedium}px</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-mansion-card/50 p-2.5">
                    <p className="text-[10px] text-text-dim">Separación</p>
                    <p className="text-sm font-semibold text-text-primary">{storyCircleGapPx}px</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-mansion-card/50 p-2.5">
                    <p className="text-[10px] text-text-dim">Anillo</p>
                    <p className="text-sm font-semibold text-text-primary">{storyCircleBorderPx}px</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-mansion-card/50 p-2.5">
                    <p className="text-[10px] text-text-dim">Espacio interno</p>
                    <p className="text-sm font-semibold text-text-primary">{storyCircleInnerGapPx}px</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>}

        {activeSection === 'videos' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Film className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Feed de Videos</h2>
          </div>
          <div className="space-y-3">
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Altura del degradado</h3>
                  <p className="text-[11px] text-text-dim">Cuánto sube el oscurecimiento desde abajo</p>
                </div>
              </div>
              <input type="range" min="0" max="800" value={videoGradientHeight} onChange={e => setVideoGradientHeight(Number(e.target.value))} className="w-full accent-mansion-gold" />
              <div className="flex justify-between text-[11px] text-text-dim mt-1">
                <span>0px</span>
                <span className="text-mansion-gold font-medium">{videoGradientHeight}px</span>
                <span>800px</span>
              </div>
            </div>

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Eye className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Intensidad del degradado</h3>
                  <p className="text-[11px] text-text-dim">Opacidad máxima del oscurecimiento</p>
                </div>
              </div>
              <input type="range" min="0" max="100" value={videoGradientOpacity} onChange={e => setVideoGradientOpacity(Number(e.target.value))} className="w-full accent-mansion-gold" />
              <div className="flex justify-between text-[11px] text-text-dim mt-1">
                <span>Sin sombra</span>
                <span className="text-mansion-gold font-medium">{videoGradientOpacity}%</span>
                <span>Máximo</span>
              </div>
            </div>

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Tamaño del avatar</h3>
                  <p className="text-[11px] text-text-dim">Diámetro del avatar de usuario en el video (móvil)</p>
                </div>
              </div>
              <input type="range" min="28" max="80" value={videoAvatarSize} onChange={e => setVideoAvatarSize(Number(e.target.value))} className="w-full accent-mansion-gold" />
              <div className="flex justify-between text-[11px] text-text-dim mt-1">
                <span>28px</span>
                <span className="text-mansion-gold font-medium">{videoAvatarSize}px</span>
                <span>80px</span>
              </div>
            </div>

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <h3 className="text-xs font-bold text-text-dim uppercase tracking-wider mb-3">Vista previa</h3>
              <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-mansion-elevated to-black" style={{ height: 140 }}>
                <div
                  className="absolute inset-x-0 bottom-0"
                  style={{
                    height: Math.min(videoGradientHeight, 140),
                    background: `linear-gradient(to top, rgba(0,0,0,${(videoGradientOpacity/100).toFixed(2)}), rgba(0,0,0,0.04), transparent)`,
                  }}
                />
                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <p className="text-white font-bold text-xs drop-shadow">@usuario</p>
                  <p className="text-white/70 text-[10px]">Caption del video...</p>
                </div>
              </div>
            </div>
          </div>
        </section>}

        {activeSection === 'encoder' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Clapperboard className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Encoder de Historias</h2>
          </div>
          <p className="text-[11px] text-text-dim mb-4">Estos parámetros controlan cómo se procesan los videos subidos como historias (FFmpeg WASM, H.264).</p>
          <div className="space-y-3">

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Duración máxima</h3>
                  <p className="text-[11px] text-text-dim">Cantidad máxima de segundos que se procesan por historia</p>
                </div>
              </div>
              <input
                type="number"
                min="1"
                max="120"
                step="1"
                value={storyMaxDurationSeconds}
                onChange={e => setStoryMaxDurationSeconds(e.target.value.replace(/[^0-9]/g, '') || '1')}
                className="w-full bg-mansion-elevated text-text-primary rounded-xl px-4 py-3 border border-white/10 text-sm"
              />
            </div>

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Threads</h3>
                  <p className="text-[11px] text-text-dim">Cantidad de hilos para el encode H.264 y el fallback</p>
                </div>
              </div>
              <select value={encoderThreads} onChange={e => setEncoderThreads(e.target.value)} className="w-full bg-mansion-elevated text-text-primary rounded-xl px-4 py-3 border border-white/10 text-sm">
                {['1','2','3','4','5','6','7','8'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* CRF */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">CRF (Calidad)</h3>
                  <p className="text-[11px] text-text-dim">Menor = mejor calidad + archivo más grande</p>
                </div>
                <span className="text-lg font-bold text-mansion-gold tabular-nums">{encoderCrf}</span>
              </div>
              <input type="range" min="18" max="40" value={encoderCrf} onChange={e => setEncoderCrf(e.target.value)} className="w-full accent-mansion-gold" />
              <div className="flex justify-between text-[11px] text-text-dim mt-1">
                <span>18 (alta)</span>
                <span>29 (default)</span>
                <span>40 (baja)</span>
              </div>
            </div>

            {/* Maxrate */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Bitrate máximo (cap)</h3>
                  <p className="text-[11px] text-text-dim">Techo de bitrate de video</p>
                </div>
              </div>
              <select value={encoderMaxrate} onChange={e => setEncoderMaxrate(e.target.value)} className="w-full bg-mansion-elevated text-text-primary rounded-xl px-4 py-3 border border-white/10 text-sm">
                {['1000k','1500k','2000k','2100k','2200k','2300k','2400k','2500k','2600k','2700k','2800k','2900k','3000k','3100k','3200k','3300k','3400k','3500k','3600k','3700k','3800k','3900k','4000k','4100k','4200k','4300k','4400k','4500k','5000k','6000k'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* Bufsize */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Buffer size</h3>
                  <p className="text-[11px] text-text-dim">Tamaño del buffer del rate control (normalmente 2-3× maxrate)</p>
                </div>
              </div>
              <select value={encoderBufsize} onChange={e => setEncoderBufsize(e.target.value)} className="w-full bg-mansion-elevated text-text-primary rounded-xl px-4 py-3 border border-white/10 text-sm">
                {['2000k','3000k','4000k','5000k','6000k','7000k','7500k','8000k','9000k','10000k','12000k','15000k'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* Preset */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Preset (Velocidad)</h3>
                  <p className="text-[11px] text-text-dim">Más rápido = peor compresión, más pesado</p>
                </div>
              </div>
              <select value={encoderPreset} onChange={e => setEncoderPreset(e.target.value)} className="w-full bg-mansion-elevated text-text-primary rounded-xl px-4 py-3 border border-white/10 text-sm">
                {['ultrafast','superfast','veryfast','faster','fast','medium'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* Audio Bitrate */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Audio Bitrate</h3>
                  <p className="text-[11px] text-text-dim">Calidad del audio AAC</p>
                </div>
              </div>
              <select value={encoderAudioBitrate} onChange={e => setEncoderAudioBitrate(e.target.value)} className="w-full bg-mansion-elevated text-text-primary rounded-xl px-4 py-3 border border-white/10 text-sm">
                {['none','16k','24k','32k','48k','64k','96k','128k'].map(v => <option key={v} value={v}>{v === 'none' ? 'Sin audio' : v}</option>)}
              </select>
            </div>

            {/* Audio Mono */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Audio Mono</h3>
                  <p className="text-[11px] text-text-dim">Convertir a mono (reduce tamaño)</p>
                </div>
                <ToggleSwitch value={encoderAudioMono} onChange={setEncoderAudioMono} />
              </div>
            </div>

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Modo debug</h3>
                  <p className="text-[11px] text-text-dim">Muestra el HUD real de progreso y el resumen técnico al finalizar la subida</p>
                </div>
                <ToggleSwitch value={encoderShowProgressHud} onChange={setEncoderShowProgressHud} />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-mansion-card rounded-2xl p-4 border border-mansion-gold/20">
              <h3 className="text-xs font-bold text-mansion-gold uppercase tracking-wider mb-2">Configuración activa</h3>
              <p className="text-sm text-text-primary font-mono">
                {storyMaxDurationSeconds}s max · {encoderThreads} threads · CRF {encoderCrf} · {encoderMaxrate} cap · {encoderBufsize} buf · {encoderPreset} · {encoderAudioBitrate === 'none' ? 'sin audio' : `AAC ${encoderAudioBitrate}${encoderAudioMono ? ' mono' : ''}`} · debug {encoderShowProgressHud ? 'on' : 'off'}
              </p>
            </div>
          </div>
        </section>}

        {/* ── EMAIL (RESEND) ── */}
        {activeSection === 'email' && <section>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4 text-mansion-gold" />
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">Email (Resend)</h2>
          </div>
          <p className="text-[11px] text-text-dim mb-4">Configuración del servicio de email transaccional (verificación de cuenta, recuperación de contraseña). Si los campos están vacíos se usan las variables de entorno del Worker.</p>
          <div className="space-y-3">

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Lock className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Resend API Key</h3>
                  <p className="text-[11px] text-text-dim">Clave de API de Resend para enviar emails. Se obtiene en resend.com/api-keys</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={resendApiKey}
                  onChange={e => setResendApiKey(e.target.value)}
                  placeholder="re_xxxxxxxxxxxx..."
                  autoComplete="off"
                  className="w-full text-sm py-2 px-3 pr-10 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted transition-colors"
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="bg-mansion-card rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-mansion-elevated flex items-center justify-center">
                  <Mail className="w-4 h-4 text-mansion-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Email remitente</h3>
                  <p className="text-[11px] text-text-dim">Dirección &quot;From&quot; de los emails (debe estar verificada en Resend)</p>
                </div>
              </div>
              <input
                type="email"
                value={mailFrom}
                onChange={e => setMailFrom(e.target.value)}
                placeholder="noreply@tudominio.com"
                className="w-full text-sm py-2 px-3 rounded-xl bg-mansion-elevated border border-mansion-border/30 text-text-primary"
              />
            </div>

          </div>
        </section>}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
            bg-gradient-to-r from-mansion-crimson to-mansion-gold text-white
            hover:shadow-lg hover:shadow-mansion-crimson/20 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar Configuración'}
        </button>
        {saveError && (
          <p className="text-center text-xs text-red-400 mt-2">{saveError}</p>
        )}
      </div>
    </div>
  );
}
