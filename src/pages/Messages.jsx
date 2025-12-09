  // frontend/src/pages/Messages.jsx
  // Página de mensagens entre compradores e vendedores.
  import { useEffect, useMemo, useRef, useState, useContext, useCallback } from 'react';
  import { useSearchParams } from 'react-router-dom';
  import { toast } from 'react-hot-toast';
  import api from '../api/api.js';
  import { AuthContext } from '../context/AuthContext.jsx';
  import {
    formatOfferAmount,
    parseOfferMessage,
    parseOfferResponse,
    OFFER_RESPONSE_PREFIX
  } from '../utils/offers.js';
  import { parseImageList, toAbsoluteImageUrl } from '../utils/images.js';
  import formatProductPrice from '../utils/currency.js';
  import { PRODUCT_CONTEXT_PREFIX, buildProductContextPayload } from '../utils/productContext.js';

  const sortConversationsByDate = (list) =>
    [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const getInitial = (value) => {
    if (!value) return 'S';
    const first = value.trim().charAt(0);
    return first ? first.toUpperCase() : 'S';
  };

  const LONG_PRESS_DELAY = 550;

  const getCoordinatesFromEvent = (event) => {
    if (!event) return { x: 0, y: 0 };
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    if (touch) {
      return { x: touch.clientX, y: touch.clientY };
    }
    return { x: event.clientX ?? 0, y: event.clientY ?? 0 };
  };

  const getConversationCounterpartId = (conversation, currentUserId) => {
    if (!conversation || !currentUserId) return null;
    return conversation.sender_id === currentUserId
      ? conversation.receiver_id
      : conversation.sender_id;
  };

  const getConversationKey = (conversation, currentUserId) => {
    const counterpartId = getConversationCounterpartId(conversation, currentUserId);
    if (!counterpartId) {
      return `conv-${conversation?.id ?? 'unknown'}`;
    }
    const normalizedCurrent = Number(currentUserId);
    const normalizedCounterpart = Number(counterpartId);
    if (!Number.isFinite(normalizedCurrent) || !Number.isFinite(normalizedCounterpart)) {
      return `conv-${counterpartId}`;
    }
    const [first, second] = [normalizedCurrent, normalizedCounterpart].sort((a, b) => a - b);
    return `conv-${first}-${second}`;
  };

  const getMessageCacheKey = (message) => {
    if (!message) return 'msg-unknown';
    if (message.id) return `msg-${message.id}`;
    if (message.message_id) return `msg-${message.message_id}`;
    return `msg-${message.created_at || message.updated_at || Date.now()}`;
  };

  const parseProductContextFromMessage = (message) => {
    if (!message || typeof message.content !== 'string') return null;
    if (!message.content.startsWith(PRODUCT_CONTEXT_PREFIX)) return null;
    const payload = message.content.slice(PRODUCT_CONTEXT_PREFIX.length);
    try {
      const parsed = JSON.parse(payload);
      return {
        ...parsed,
        productId: parsed.productId ?? message.product_id ?? null,
        timestamp:
          parsed.timestamp ||
          new Date(message.created_at || message.updated_at || Date.now()).getTime()
      };
    } catch {
      return null;
    }
  };

  const findLatestContextPreview = (messages, targetProductId) => {
    if (!Array.isArray(messages) || !targetProductId) return null;
    const normalizedProduct = Number(targetProductId);
    if (!Number.isFinite(normalizedProduct)) return null;
    let latest = null;
    for (const message of messages) {
      const context = parseProductContextFromMessage(message);
      if (!context || !context.productId) continue;
      if (!Number.isFinite(Number(context.productId))) continue;
      if (Number(context.productId) !== normalizedProduct) continue;
      if (!latest || (context.timestamp || 0) > (latest.timestamp || 0)) {
        latest = context;
      }
    }
    return latest;
  };

  const findLastContextProductId = (messages) => {
    if (!Array.isArray(messages)) return null;
    let latest = null;
    for (const message of messages) {
      const context = parseProductContextFromMessage(message);
      if (!context || !context.productId) continue;
      if (!latest || (context.timestamp || 0) > (latest.timestamp || 0)) {
        latest = context;
      }
    }
    if (!latest || !latest.productId) return null;
    return Number.isFinite(Number(latest.productId)) ? Number(latest.productId) : null;
  };

  const buildContextSetKey = (productId, counterpartId) => {
    if (!productId || !counterpartId) return null;
    const product = Number(productId);
    const counterpart = Number(counterpartId);
    if (!Number.isFinite(product)) return null;
    if (!Number.isFinite(counterpart)) return `ctx-${product}`;
    return `ctx-${counterpart}-${product}`;
  };

  export default function Messages() {
    const { token, user } = useContext(AuthContext);
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [selectedMeta, setSelectedMeta] = useState({ title: '', seller: '', counterpart: '', avatar: '' });
    const [selectedProductInfo, setSelectedProductInfo] = useState(null);
    const [counterpartId, setCounterpartId] = useState(null);
    const [newMsg, setNewMsg] = useState('');
    const [sending, setSending] = useState(false);
    const [respondingOfferId, setRespondingOfferId] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [deletingMessageId, setDeletingMessageId] = useState(null);
    const [deletingConversationKey, setDeletingConversationKey] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [activeConversationKey, setActiveConversationKey] = useState(null);
    const [searchParams] = useSearchParams();
    const [previewContext, setPreviewContext] = useState(null);
    const sendSoundRef = useRef(null);
    const receiveSoundRef = useRef(null);
    const pendingContextRef = useRef(null);
    const lastMessageCountRef = useRef(null);
    const pollingRef = useRef(null);
    const conversationsRef = useRef([]);
    const lastQueryProductRef = useRef(null);
    const messagesEndRef = useRef(null);
    const longPressTimerRef = useRef(null);
    const lastNotificationTokenRef = useRef(null);
    const forcedChatRef = useRef(null);
    const activeConversationRef = useRef({ counterpartId: null, productId: null });
    const userId = user?.id;
    const userDisplayName = user?.username || user?.name || 'Usuário SaleDay';
    const threadContainerRef = useRef(null);
    const userAvatar = user?.profile_image_url ?? '';
    const userInitial = useMemo(
      () => getInitial(user?.username || user?.email || userDisplayName),
      [user?.username, user?.email, userDisplayName]
    );
    const [autoScroll, setAutoScroll] = useState(true);
    const AUTO_SCROLL_THRESHOLD = 80;

    useEffect(() => {
      if (!receiveSoundRef.current) {
        const receiveAudio = new Audio('/sounds/mensagem2.mp3');
        receiveAudio.volume = 0.35;
        receiveSoundRef.current = receiveAudio;
      }
      if (!sendSoundRef.current) {
        const sendAudio = new Audio('/sounds/mensgem.mp3');
        sendAudio.volume = 0.35;
        sendSoundRef.current = sendAudio;
      }
    }, []);

    useEffect(() => {
      if (typeof window === 'undefined') return undefined;
      const raw = window.sessionStorage.getItem('saleday:forced-chat');
      if (!raw) return undefined;
      try {
        forcedChatRef.current = JSON.parse(raw);
      } catch {
        forcedChatRef.current = null;
      }
      window.sessionStorage.removeItem('saleday:forced-chat');
      return undefined;
    }, []);

    const loadConversations = useCallback(async () => {
      if (!token) return;
      try {
        const response = await api.get('/messages', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = Array.isArray(response.data?.data) ? response.data.data.slice() : [];
        setConversations(sortConversationsByDate(data));
      } catch (err) {
        console.error(err);
      }
    }, [token]);

    useEffect(() => {
      loadConversations();
    }, [loadConversations]);


    useEffect(() => {
      if (!token) return undefined;
      const timer = setInterval(() => {
        loadConversations();
      }, 5000);
      return () => clearInterval(timer);
    }, [token, loadConversations]);

    useEffect(() => {
      conversationsRef.current = conversations;
    }, [conversations]);

    const determineCounterpart = useCallback(
      (data, fallback) => {
        if (data.length > 0) {
          const lastMessage = data[data.length - 1];
          return lastMessage.sender_id === userId ? lastMessage.receiver_id : lastMessage.sender_id;
        }
        if (fallback) {
          return fallback.sender_id === userId ? fallback.receiver_id : fallback.sender_id;
        }
        return null;
      },
      [userId]
    );

    const resolveCounterpartProfile = useCallback(
      (data, conversation, explicitCounterpartId = null) => {
        const counterpart = explicitCounterpartId ?? determineCounterpart(data, conversation);
        if (counterpart) {
          const fromMessages = [...data].reverse().find(
            (msg) => msg.sender_id === counterpart || msg.receiver_id === counterpart
          );
          if (fromMessages) {
            const isSender = fromMessages.sender_id === counterpart;
            return {
              id: counterpart,
              name: (isSender ? fromMessages.sender_name : fromMessages.receiver_name) || null,
              avatar: (isSender ? fromMessages.sender_avatar : fromMessages.receiver_avatar) || null
            };
          }
        }

        if (conversation) {
          const isSender = userId && conversation.sender_id === userId;
          return {
            id: isSender ? conversation.receiver_id : conversation.sender_id,
            name: isSender
              ? conversation.receiver_name || conversation.seller_name || null
              : conversation.sender_name || conversation.seller_name || null,
            avatar: isSender ? conversation.receiver_avatar || null : conversation.sender_avatar || null
          };
        }

        return { id: counterpart || null, name: null, avatar: null };
      },
      [determineCounterpart, userId]
    );

    const fetchMessages = useCallback(
      async ({
        counterpartId: targetCounterpartId,
        productId: contextProductId = null,
        playSound = false,
        conversation = null,
        fallbackCounterpartName = '',
        fallbackProductTitle = ''
      } = {}) => {
        if (!token || !targetCounterpartId) return [];
        const normalizedCounterpart =
          Number.isFinite(Number(targetCounterpartId)) && Number(targetCounterpartId) > 0
            ? Number(targetCounterpartId)
            : null;
        if (!normalizedCounterpart) return [];
        const normalizedContextProductId =
          contextProductId !== null &&
          contextProductId !== undefined &&
          Number.isFinite(Number(contextProductId))
            ? Number(contextProductId)
            : null;
        try {
          const suffix =
            normalizedContextProductId
              ? `?productId=${normalizedContextProductId}`
              : '';
          const response = await api.get(`/messages/seller/${normalizedCounterpart}${suffix}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = response.data?.data ?? [];
          const activeConversation = activeConversationRef.current;
          const isActiveConversation =
            activeConversation.counterpartId === normalizedCounterpart &&
            activeConversation.productId === normalizedContextProductId;
          if (!isActiveConversation) {
            return data;
          }
          const profile = resolveCounterpartProfile(data, conversation, normalizedCounterpart);

          if (
            playSound &&
            receiveSoundRef.current &&
            lastMessageCountRef.current !== null &&
            data.length > lastMessageCountRef.current
          ) {
            receiveSoundRef.current.currentTime = 0;
            receiveSoundRef.current.play().catch(() => {});
          }

          setMessages(data);
          const lastContextProductId = findLastContextProductId(data);
          let previewPayload = null;
          if (pendingContextRef.current && pendingContextRef.current.payload) {
            if (pendingContextRef.current.productId === lastContextProductId) {
              pendingContextRef.current = null;
            } else {
              previewPayload = pendingContextRef.current.payload;
            }
          }
          if (!previewPayload && normalizedContextProductId) {
            const contextPreview = findLatestContextPreview(data, normalizedContextProductId);
            if (contextPreview) {
              const shouldQueue =
                lastContextProductId == null || lastContextProductId !== normalizedContextProductId;
              if (shouldQueue) {
                pendingContextRef.current = {
                  productId: contextPreview.productId,
                  contextMeta: contextPreview,
                  contextKey: contextPreview.productId,
                  payload: contextPreview
                };
                previewPayload = contextPreview;
              } else {
                pendingContextRef.current = null;
              }
            }
          }
          setPreviewContext(previewPayload || null);

          if (data.length > 0) {
            const meta = data[data.length - 1];
            setSelectedMeta({
              title:
                meta.product_title ||
                fallbackProductTitle ||
                meta.content ||
                'Conversa privada',
              seller: meta.seller_name || profile.name || '',
              counterpart: profile.name || meta.seller_name || '',
              avatar: profile.avatar || ''
            });
          } else if (conversation) {
            setSelectedMeta({
              title: conversation.product_title || fallbackProductTitle || 'Conversa privada',
              seller: conversation.seller_name,
              counterpart: profile.name || conversation.seller_name || '',
              avatar: profile.avatar || ''
            });
          } else {
            const fallbackTitle =
              fallbackProductTitle ||
              (fallbackCounterpartName ? `Conversa com ${fallbackCounterpartName}` : 'Conversa direta');
            setSelectedMeta((prev) => ({
              title: prev.title || fallbackTitle,
              seller: prev.seller || fallbackCounterpartName || '',
              counterpart: prev.counterpart || fallbackCounterpartName || '',
              avatar: prev.avatar || ''
            }));
          }

          setCounterpartId(normalizedCounterpart);
          lastMessageCountRef.current = data.length;
          return data;
        } catch (err) {
          console.error(err);
          return [];
        }
      },
      [token, resolveCounterpartProfile]
    );

    const parseProductIdValue = (value) => {
      if (value === null || value === undefined) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const openChat = useCallback(
      async (
        productId,
        conversation,
        {
          fallbackCounterpartId = null,
          fallbackCounterpartName = '',
          fallbackProductTitle = '',
          queueProductContext = false,
          contextMeta = {}
        } = {}
      ) => {
        const parsedProductId = parseProductIdValue(productId);
        const hasProduct = parsedProductId !== null;
        const conversationCounterpart = determineCounterpart([], conversation);
        const fallbackCounterpartNumeric =
          fallbackCounterpartId !== null && fallbackCounterpartId !== undefined
            ? Number(fallbackCounterpartId)
            : null;
        const resolvedCounterpart =
          Number.isFinite(Number(conversationCounterpart)) && conversationCounterpart
            ? Number(conversationCounterpart)
            : Number.isFinite(fallbackCounterpartNumeric)
              ? fallbackCounterpartNumeric
              : null;
        if (!resolvedCounterpart) return;
        activeConversationRef.current = {
          counterpartId: resolvedCounterpart,
          productId: hasProduct ? parsedProductId : null
        };
        const conversationKeyFromData = conversation
          ? getConversationKey(conversation, userId)
          : null;
        const fallbackKey =
          userId && resolvedCounterpart
            ? getConversationKey(
                { sender_id: userId, receiver_id: resolvedCounterpart },
                userId
              )
            : null;
        const resolvedKey = conversationKeyFromData || fallbackKey;
        if (resolvedKey) {
          setActiveConversationKey(resolvedKey);
        }
        setMessages([]);
        pendingContextRef.current = null;
        setPreviewContext(null);
        const contextKey =
          hasProduct && resolvedCounterpart
            ? buildContextSetKey(parsedProductId, resolvedCounterpart)
            : null;

        setSelectedProductInfo(null);
        setSelectedProduct(hasProduct ? parsedProductId : null);
        lastMessageCountRef.current = null; // reset so initial load doesn't play sound
        setAutoScroll(true);
        await fetchMessages({
          counterpartId: resolvedCounterpart,
          productId: hasProduct ? parsedProductId : null,
          playSound: false,
          conversation,
          fallbackCounterpartName,
          fallbackProductTitle: hasProduct ? fallbackProductTitle : ''
        });

        setConversations((prev) =>
          sortConversationsByDate(
            prev.map((conv) => {
              const convCounterpart = getConversationCounterpartId(conv, userId);
              if (convCounterpart && Number(convCounterpart) === resolvedCounterpart) {
                return { ...conv, is_read: true };
              }
              return conv;
            })
          )
        );

        pendingContextRef.current = null;
        const resolvedContextMeta = { ...(contextMeta || {}) };
        if (fallbackProductTitle && !resolvedContextMeta.title) {
          resolvedContextMeta.title = fallbackProductTitle;
        }

        let fetchedProductData = null;
        if (hasProduct) {
          if (queueProductContext && contextKey) {
            const previewPayload = buildProductContextPayload(parsedProductId, resolvedContextMeta);
            pendingContextRef.current = {
              productId: parsedProductId,
              contextMeta: resolvedContextMeta,
              contextKey,
              payload: previewPayload
            };
            setPreviewContext(previewPayload);
          } else {
            pendingContextRef.current = null;
            setPreviewContext(null);
          }
          try {
            const response = await api.get(`/products/${parsedProductId}`);
            fetchedProductData = response.data?.data ?? null;
            setSelectedProductInfo(fetchedProductData);
            if (
              pendingContextRef.current &&
              pendingContextRef.current.productId === parsedProductId &&
              fetchedProductData
            ) {
              const refreshed = buildProductContextPayload(
                parsedProductId,
                pendingContextRef.current.contextMeta,
                fetchedProductData
              );
              pendingContextRef.current.payload = refreshed;
              setPreviewContext(refreshed);
            }
          } catch {
            setSelectedProductInfo(null);
          }
        } else {
          pendingContextRef.current = null;
          setPreviewContext(null);
          setSelectedProductInfo(null);
        }
      },
      [fetchMessages, determineCounterpart, userId]
    );

    useEffect(() => {
      const forced = forcedChatRef.current;
      if (!forced) return;
      const parsedProductId = Number(forced.productId);
      if (!Number.isFinite(parsedProductId)) return;
      openChat(parsedProductId, null, {
        fallbackCounterpartId:
          forced.counterpartId !== undefined && forced.counterpartId !== null
            ? Number(forced.counterpartId)
            : null,
        fallbackCounterpartName: forced.counterpartName || '',
        fallbackProductTitle: forced.productTitle || '',
        queueProductContext: true,
        contextMeta: {
          image: forced.productImage,
          price: forced.productPrice,
          location: forced.productLocation,
          title: forced.productTitle
        }
      });
      forcedChatRef.current = null;
    }, [openChat]);

    // open chat from query param when conversations fetched
    useEffect(() => {
      const pid = searchParams.get('product');
      const sellerParam = searchParams.get('seller');
      const productTitleParam = (searchParams.get('productTitle') || '').trim();
      const notificationToken = searchParams.get('notificationToken') || null;
      if (!pid && !sellerParam) {
        lastQueryProductRef.current = null;
        lastNotificationTokenRef.current = null;
        return;
      }
      const numericId = pid ? Number(pid) : NaN;
      const hasProductParam = Number.isFinite(numericId);
      const sameProduct = hasProductParam && lastQueryProductRef.current === numericId;
      if (sameProduct) {
        if (!notificationToken) return;
        if (lastNotificationTokenRef.current === notificationToken) return;
      }
      lastQueryProductRef.current = hasProductParam ? numericId : null;
      lastNotificationTokenRef.current = notificationToken;
      const buyerParam = searchParams.get('buyer');
      const parsedSeller = sellerParam ? Number(sellerParam) : null;
      const parsedBuyer = buyerParam ? Number(buyerParam) : null;
      const fallbackCounterpartId =
        Number.isFinite(parsedSeller) ? parsedSeller : Number.isFinite(parsedBuyer) ? parsedBuyer : null;
      const existingConversation =
        Number.isFinite(fallbackCounterpartId) && userId
          ? conversationsRef.current.find(
              (c) => Number(getConversationCounterpartId(c, userId)) === fallbackCounterpartId
            )
          : null;
      const fallbackCounterpartName =
        searchParams.get('buyerName') || searchParams.get('sellerName') || '';

      openChat(hasProductParam ? numericId : null, existingConversation, {
        fallbackCounterpartId,
        fallbackCounterpartName,
        fallbackProductTitle: productTitleParam,
        queueProductContext: hasProductParam,
        contextMeta: {
          image: searchParams.get('productImage') || undefined,
          price: searchParams.get('productPrice') || undefined,
          location: searchParams.get('productLocation') || undefined,
          title: productTitleParam || undefined
        }
      });
      setSidebarOpen(false);
    }, [searchParams, openChat, userId]);

    // polling active conversation
    useEffect(() => {
      if (!counterpartId) return undefined;

      const poll = async () => {
        const conversation =
          conversationsRef.current.find((conv) => {
            const convCounterpart = getConversationCounterpartId(conv, userId);
            return Number(convCounterpart) === Number(counterpartId);
          }) ?? null;
        await fetchMessages({
          counterpartId,
          productId: selectedProduct,
          playSound: true,
          conversation,
          fallbackCounterpartId: counterpartId,
          fallbackCounterpartName: selectedMeta.counterpart || selectedMeta.seller || ''
        });
      };

      poll();
      pollingRef.current = setInterval(poll, 5000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }, [
      counterpartId,
      selectedProduct,
      fetchMessages,
      selectedMeta.counterpart,
      selectedMeta.seller,
      userId
    ]);

    const sendProductContextMessage = useCallback(
      async (receiverId) => {
        if (!token || !selectedProduct || !receiverId) return false;
        const pending = pendingContextRef.current;
        if (!pending) return false;
        const normalizedPending = Number(pending.productId);
        const currentProduct = Number(selectedProduct);
        if (
          !Number.isFinite(normalizedPending) ||
          !Number.isFinite(currentProduct) ||
          normalizedPending !== currentProduct
        ) {
          return false;
        }
        const payload =
          pending.payload ||
          buildProductContextPayload(normalizedPending, pending.contextMeta, selectedProductInfo);
        try {
          await api.post(
            '/messages',
            {
              product_id: normalizedPending,
              content: `${PRODUCT_CONTEXT_PREFIX}${JSON.stringify(payload)}`,
              receiver_id: receiverId
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          pendingContextRef.current = null;
          setPreviewContext(null);
          return true;
        } catch (error) {
          console.error('Falha ao enviar contexto do produto', error);
          return false;
        }
      },
      [selectedProduct, selectedProductInfo, token]
    );

    const handleSend = useCallback(
      async (event) => {
        event.preventDefault();
        const isProductChat = Number.isFinite(selectedProduct);
        if (!newMsg.trim() || !counterpartId || !token || sending) {
          return;
        }
        setSending(true);
        const conversation =
          conversationsRef.current.find((c) => {
            const convCounterpart = getConversationCounterpartId(c, userId);
            return (
              convCounterpart !== null &&
              counterpartId !== null &&
              Number(convCounterpart) === Number(counterpartId)
            );
          }) ?? null;
        const targetId =
          isProductChat && selectedProduct
            ? counterpartId ?? determineCounterpart(messages, conversation)
            : counterpartId;

        if (!targetId) {
          setSending(false);
          toast.error('Não foi possível identificar o destinatário da mensagem.');
          return;
        }

        try {
          const isCurrentUserSeller =
            selectedProductInfo?.user_id && selectedProductInfo.user_id === userId;
          if (isProductChat && !isCurrentUserSeller) {
            await sendProductContextMessage(targetId);
            await api.post(
              '/messages',
              {
                product_id: selectedProduct,
                content: newMsg.trim(),
                receiver_id: targetId
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } else {
            await api.post(
              `/messages/seller/${targetId}`,
              { content: newMsg.trim() },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          }
          setNewMsg('');
          if (sendSoundRef.current) {
            sendSoundRef.current.currentTime = 0;
            sendSoundRef.current.play().catch(() => {});
          }
          lastMessageCountRef.current = null; // avoid skipping play on new incoming
          setAutoScroll(true);
          await fetchMessages({
            counterpartId: targetId,
            productId: isProductChat ? selectedProduct : null,
            playSound: false,
            conversation
          });
          await loadConversations();
        } catch (err) {
          console.error(err);
          toast.error('Não foi possível enviar a mensagem. Tente novamente.');
        } finally {
          setSending(false);
        }
      },
      [
        newMsg,
        selectedProduct,
        token,
        counterpartId,
        sending,
        fetchMessages,
        loadConversations,
        determineCounterpart,
        conversationsRef,
        messages,
        selectedProductInfo,
        userId
      ]
    );

    const handleDeleteMessage = useCallback(
      async (messageId) => {
        if (!token || !messageId) return;
        if (typeof window !== 'undefined') {
          const confirmed = window.confirm('Apagar mensagem!');
          if (!confirmed) return;
        }
        setDeletingMessageId(messageId);
        try {
          await api.delete(`/messages/${messageId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
          toast.success('Mensagem apagada.');
          await loadConversations();
        } catch (err) {
          console.error(err);
          toast.error('Não foi possível apagar a mensagem.');
        } finally {
          setDeletingMessageId(null);
        }
      },
      [token, loadConversations]
    );

    const closeContextMenu = useCallback(() => {
      setContextMenu(null);
    }, []);

    const cancelLongPress = useCallback(() => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }, []);

    const openContextMenu = useCallback((event, payload) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation?.();
      }
      const coords = getCoordinatesFromEvent(event);
      setContextMenu({ ...payload, ...coords });
    }, []);

    const startLongPress = useCallback(
      (event, payload) => {
        if (!event) return;
        if (event.touches && event.touches.length > 1) return;
        cancelLongPress();
        const coords = getCoordinatesFromEvent(event);
        longPressTimerRef.current = setTimeout(() => {
          setContextMenu({ ...payload, ...coords });
        }, LONG_PRESS_DELAY);
      },
      [cancelLongPress]
    );

    useEffect(
      () => () => {
        cancelLongPress();
      },
      [cancelLongPress]
    );

    useEffect(() => {
      const handleEscape = (event) => {
        if (event.key === 'Escape') closeContextMenu();
      };
      const handleClose = () => closeContextMenu();
      window.addEventListener('keydown', handleEscape);
      window.addEventListener('resize', handleClose);
      window.addEventListener('scroll', handleClose, true);
      return () => {
        window.removeEventListener('keydown', handleEscape);
        window.removeEventListener('resize', handleClose);
        window.removeEventListener('scroll', handleClose, true);
      };
    }, [closeContextMenu]);

    useEffect(() => {
      if (!threadContainerRef.current) return;
      const container = threadContainerRef.current;
      const handleScroll = () => {
        const distance = container.scrollHeight - (container.scrollTop + container.clientHeight);
        setAutoScroll(distance <= AUTO_SCROLL_THRESHOLD);
      };
      handleScroll();
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }, []);

    useEffect(() => {
      if (!messagesEndRef.current || !autoScroll) return;
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }, [messages, autoScroll]);

    useEffect(() => {
      if (!selectedProductInfo) return;
      const isProductOwner =
        selectedProductInfo.user_id && selectedProductInfo.user_id === userId;
      if (isProductOwner) {
        pendingContextRef.current = null;
        setPreviewContext(null);
      }
      const fallbackCounterpartName = !isProductOwner ? selectedProductInfo.seller_name || '' : '';
      const fallbackAvatar = !isProductOwner ? selectedProductInfo.seller_avatar || '' : '';
      setSelectedMeta((prev) => ({
        title: prev.title || selectedProductInfo.title || '',
        seller: prev.seller || selectedProductInfo.seller_name || '',
        counterpart: prev.counterpart || fallbackCounterpartName || '',
        avatar: prev.avatar || fallbackAvatar
      }));
      if (
        !counterpartId &&
        selectedProductInfo.user_id &&
        !isProductOwner
      ) {
        setCounterpartId(selectedProductInfo.user_id);
      }
    }, [selectedProductInfo, counterpartId, userId]);

    const isSeller = Boolean(selectedProductInfo?.user_id && selectedProductInfo.user_id === userId);
    const productSold = selectedProductInfo?.status === 'sold';
    const hasActiveConversation = Boolean(counterpartId);
    const headerPartnerName = selectedMeta.counterpart || selectedMeta.seller || 'Vendedor SaleDay';
    const headerSubtitle = selectedProduct ? 'Produto em foco abaixo' : 'Mensagens privadas';
    const sortedMessages = useMemo(() => {
      return [...messages].sort(
        (a, b) =>
          (new Date(a.created_at || a.updated_at || 0).getTime() || 0) -
          (new Date(b.created_at || b.updated_at || 0).getTime() || 0)
      );
    }, [messages]);

    const contextEntriesMap = useMemo(() => {
      const map = new Map();
      sortedMessages.forEach((msg) => {
        const context = parseProductContextFromMessage(msg);
        if (!context) return;
        const key = getMessageCacheKey(msg);
        map.set(key, {
          ...context,
          id: context.id || `ctx-${key}`,
          image: context.image || '',
          price: context.price || null,
          location: context.location || ''
        });
      });
      return map;
    }, [sortedMessages]);

    const mergedFeedItems = useMemo(() => {
      const items = [];
      for (const msg of sortedMessages) {
        const key = getMessageCacheKey(msg);
        if (contextEntriesMap.has(key)) {
          items.push({ type: 'context', context: contextEntriesMap.get(key) });
          continue;
        }
        items.push({ type: 'message', message: msg });
      }
      return items;
    }, [sortedMessages, contextEntriesMap]);

    const offerResponses = useMemo(() => {
      if (!messages.length) return {};
      return messages.reduce((acc, msg) => {
        const response = parseOfferResponse(msg.content);
        if (response?.targetMessageId) {
          acc[response.targetMessageId] = response;
        }
        return acc;
      }, {});
    }, [messages]);

    const respondToOffer = useCallback(
      async (offerMessage, decision) => {
        if (!token || !selectedProduct || !isSeller || !userId) return;
        const offerData = parseOfferMessage(offerMessage.content);
        if (!offerData) return;
        const receiverId =
          offerMessage.sender_id === userId ? offerMessage.receiver_id : offerMessage.sender_id;

        setRespondingOfferId(offerMessage.id);
        try {
          if (decision === 'accept' && selectedProductInfo?.status !== 'sold') {
            await api.put(
              `/products/${selectedProduct}/status`,
              { status: 'sold' },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedProductInfo((prev) =>
              prev ? { ...prev, status: 'sold' } : { status: 'sold', user_id: userId }
            );
          }

          const responsePayload = {
            targetMessageId: offerMessage.id,
            status: decision === 'accept' ? 'accepted' : 'declined',
            offer: offerData,
            responderId: userId,
            responderName: userDisplayName,
            createdAt: new Date().toISOString()
          };

          await api.post(
            '/messages',
            {
              product_id: selectedProduct,
              content: `${OFFER_RESPONSE_PREFIX}${JSON.stringify(responsePayload)}`,
              receiver_id: receiverId
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          toast.success(
            decision === 'accept'
              ? 'Oferta aceita! Produto marcado como vendido.'
              : 'Oferta recusada.'
          );
          await fetchMessages({
            counterpartId: receiverId,
            productId: selectedProduct,
            playSound: false
          });
          await loadConversations();
        } catch (err) {
          console.error(err);
          toast.error('Não foi possível responder à oferta. Tente novamente.');
        } finally {
          setRespondingOfferId(null);
        }
      },
      [
        token,
        selectedProduct,
        isSeller,
        selectedProductInfo?.status,
        userId,
        userDisplayName,
        fetchMessages,
        loadConversations
      ]
    );

    const handleDeleteConversation = useCallback(
      async (conversation) => {
        if (!token || !conversation || !userId) return;
        const conversationCounterpartId = getConversationCounterpartId(conversation, userId);
        if (!conversationCounterpartId) return;
        if (typeof window !== 'undefined') {
          const confirmed = window.confirm('Apagar conversa!');
          if (!confirmed) return;
        }
        const convKey = getConversationKey(conversation, userId);
        setDeletingConversationKey(convKey);
        try {
          await api.delete(
            `/messages/conversation/${conversation.product_id}/${conversationCounterpartId}`,
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          );
          setConversations((prev) =>
            prev.filter((item) => getConversationKey(item, userId) !== convKey)
          );
          if (
            counterpartId !== null &&
            Number(conversationCounterpartId) === Number(counterpartId)
          ) {
            setSelectedProduct(null);
            setMessages([]);
            setSelectedProductInfo(null);
            setCounterpartId(null);
            setActiveConversationKey(null);
            activeConversationRef.current = { counterpartId: null, productId: null };
          }
          toast.success('Conversa apagada.');
          await loadConversations();
        } catch (err) {
          console.error(err);
          toast.error('Não foi possível apagar a conversa.');
        } finally {
          setDeletingConversationKey(null);
        }
      },
      [token, userId, selectedProduct, loadConversations]
    );

    const handleConversationClick = useCallback(
      (conversation) => {
        if (!conversation) return;
        const locationLabel = [conversation.product_city, conversation.product_state, conversation.product_country]
          .filter(Boolean)
          .join(', ');
        const contextMeta = {};
        if (conversation.product_title) contextMeta.title = conversation.product_title;
        if (conversation.product_image_url) contextMeta.image = conversation.product_image_url;
        if (locationLabel) contextMeta.location = locationLabel;
        const priceValue = conversation.product_price ?? conversation.price ?? null;
        const priceCurrency = conversation.product_currency ?? conversation.currency ?? null;
        if (priceValue != null && priceCurrency) {
          contextMeta.price = formatProductPrice(priceValue, priceCurrency);
        } else if (priceValue != null) {
          contextMeta.price = priceValue;
        }
        openChat(conversation.product_id, conversation, {
          fallbackProductTitle: conversation.product_title || '',
          queueProductContext: Boolean(conversation.product_id),
          contextMeta
        });
        setSidebarOpen(false);
        closeContextMenu();
      },
      [openChat, closeContextMenu]
    );

    const headerOffset = 'var(--home-header-height, 64px)';
    const viewportHeight = `calc(100vh - ${headerOffset})`;

    const renderConversationList = () => (
      <ConversationSidebar
        conversations={conversations}
        userId={userId}
        counterpartId={counterpartId}
        activeConversationKey={activeConversationKey}
        deletingConversationKey={deletingConversationKey}
        onConversationClick={handleConversationClick}
        onContextMenu={openContextMenu}
        onStartLongPress={startLongPress}
        onCancelLongPress={cancelLongPress}
        onCloseSidebar={() => setSidebarOpen(false)}
      />
    );

    return (
      <>
      <div className="flex h-screen flex-col overflow-hidden bg-slate-50 pt-[calc(var(--home-header-height,64px)+2rem)]">


          <div className="mx-auto flex h-full w-full max-w-[1400px] flex-1 flex-col gap-[18px] px-4 py-4 lg:flex-row lg:gap-6 lg:px-6 lg:py-4">
            <aside className="hidden lg:flex lg:w-full lg:max-w-xs">{renderConversationList()}</aside>

            <section className="flex flex-1 flex-col min-h-0 overflow-hidden overscroll-none">
            <div className="relative flex flex-1 flex-col min-h-0 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_60px_rgba(15,23,42,0.12)] transition-all duration-300">
            {hasActiveConversation ? (
                  <>
              <header className="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-5 shadow backdrop-blur-lg">

    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-2xl font-semibold text-white shadow-lg shadow-blue-500/20">
                          {selectedMeta.avatar ? (
                            <img
                              src={selectedMeta.avatar}
                              alt={
                                selectedMeta.counterpart || selectedMeta.seller || 'Usuário SaleDay'
                              }
                              className="h-full w-full rounded-2xl object-cover"
                            />
                          ) : (
                            getInitial(selectedMeta.counterpart || selectedMeta.seller || 'SaleDay')
                          )}
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-xl font-semibold text-slate-900">
                            {headerPartnerName}
                          </h2>
                          <p className="truncate text-sm text-slate-500">{headerSubtitle}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {productSold && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-inner">
                            Produto vendido
                          </span>
                        )}
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-600 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 lg:hidden"
                          onClick={() => setSidebarOpen(true)}
                        >
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          Conversas
                        </button>
                      </div>
                    </header>

                    <div
  ref={threadContainerRef}
  className="flex-1 overflow-y-auto overscroll-y-contain px-4 pt-[104px] transition-all duration-300"
  style={{ scrollPaddingBottom: '160px', paddingBottom: '160px' }}
>


                      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
                        {mergedFeedItems.map((item) => {
                          if (item.type === 'context') {
                            const context = item.context;
                            return <ProductContextCard key={context.id} context={context} />;
                          }

                          const m = item.message;
                          const offerData = parseOfferMessage(m.content);
                          const offerResponse = parseOfferResponse(m.content);
                          if (offerResponse) {
                            return null;
                          }

                          const isSender = m.sender_id === userId;
                          const senderName = isSender
                            ? userDisplayName
                            : m.sender_name ||
                              selectedMeta.counterpart ||
                              selectedMeta.seller ||
                              'Usuário SaleDay';
                          const senderAvatar = isSender
                            ? userAvatar
                            : m.sender_avatar || selectedMeta.avatar || null;
                          const senderInitial = isSender ? userInitial : getInitial(senderName);
                          const leftAvatar = !isSender ? (
                            <AvatarBadge avatar={senderAvatar} label={senderName} />
                          ) : null;
                          const rightAvatar = isSender ? (
                            <AvatarBadge avatar={userAvatar} label={userDisplayName} />
                          ) : null;

                          if (offerData) {
                            const response = offerResponses[m.id];
                            return (
                              <div
                                key={`offer-${m.id}`}
                                className={`flex items-end gap-3 ${
                                  isSender ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                {leftAvatar}
                                <div className="flex w-full max-w-[90%] items-stretch gap-3">
                                  <span
                                    className={`h-full w-1 rounded-full ${
                                      isSender ? 'bg-blue-100' : 'bg-amber-100'
                                    }`}
                                  />
                                  <OfferBubble
                                    offerData={offerData}
                                    response={response}
                                    offerMessage={m}
                                    isSender={isSender}
                                    isSeller={isSeller}
                                    productSold={productSold}
                                    respondToOffer={respondToOffer}
                                    respondingOfferId={respondingOfferId}
                                  />
                                </div>
                                {rightAvatar}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={`msg-${m.id}`}
                              className={`flex items-end gap-3 ${
                                isSender ? 'justify-end' : 'justify-start'
                              }`}
                              onContextMenu={(event) =>
                                openContextMenu(event, { type: 'message', messageId: m.id })
                              }
                              onTouchStart={(event) =>
                                startLongPress(event, { type: 'message', messageId: m.id })
                              }
                              onTouchEnd={cancelLongPress}
                              onTouchMove={cancelLongPress}
                              onTouchCancel={cancelLongPress}
                            >
                              {leftAvatar}
                              <div className="flex w-full max-w-[85%] items-stretch gap-3">
                                <span
                                  className={`h-full w-1 rounded-full ${
                                    isSender ? 'bg-blue-100' : 'bg-amber-100'
                                  }`}
                                />
                                <MessageBubble content={m.content} isSender={isSender} />
                              </div>
                              {rightAvatar}
                            </div>
                          );
                        })}
                        <span ref={messagesEndRef} />
                      </div>
                    </div>

                    {!isSeller && previewContext && <ProductPreview context={previewContext} />}

                    <form
                      onSubmit={handleSend}
                      className="sticky z-40 flex flex-row flex-nowrap items-center gap-3 border-t border-slate-100 bg-white px-5 py-4 pb-[env(safe-area-inset-bottom)] w-full"
                      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 38px)' }}
                    >

                      <label htmlFor="message-input" className="sr-only">
                        Digite sua mensagem
                      </label>
                      <input
                        id="message-input"
                        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition-all duration-200 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed"
                        value={newMsg}
                        onChange={(e) => setNewMsg(e.target.value)}
                        placeholder="Digite sua mensagem..."
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={sending || !newMsg.trim()}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 10.5l11-6.5a1 1 0 011.4 1.1L13 11l2.4 5.9a1 1 0 01-1.4 1.1l-11-6.5a1 1 0 010-1.8z" />
                        </svg>
                        {sending ? 'Enviando...' : 'Enviar'}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-slate-500">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                      <span className="text-2xl font-semibold">💬</span>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-slate-900">Conversa privada</p>
                      <p className="text-sm text-slate-500">
                        Escolha uma conversa ou envie uma proposta para começar.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 lg:hidden"
                      onClick={() => setSidebarOpen(true)}
                    >
                      Abrir conversas
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
          {renderConversationList()}
        </MobileSidebar>

        {contextMenu && (
          <div
            className="fixed inset-0 z-50"
            onClick={closeContextMenu}
            onContextMenu={(event) => {
              event.preventDefault();
              closeContextMenu();
            }}
          >
            <div
              className="absolute w-48 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
              style={{
                top:
                  typeof window !== 'undefined'
                    ? Math.min(contextMenu.y, window.innerHeight - 80)
                    : contextMenu.y,
                left:
                  typeof window !== 'undefined'
                    ? Math.min(contextMenu.x, window.innerWidth - 200)
                    : contextMenu.x
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {contextMenu.type === 'message' && (
                <button
                  type="button"
                  onClick={() => {
                    closeContextMenu();
                    handleDeleteMessage(contextMenu.messageId);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  disabled={deletingMessageId === contextMenu.messageId}
                >
                  <span>
                    {deletingMessageId === contextMenu.messageId ? 'Removendo...' : 'Apagar mensagem!'}
                  </span>
                </button>
              )}
              {contextMenu.type === 'conversation' && contextMenu.conversation && (
                <button
                  type="button"
                  onClick={() => {
                    closeContextMenu();
                    handleDeleteConversation(contextMenu.conversation);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                  disabled={
                    Boolean(deletingConversationKey) &&
                    getConversationKey(contextMenu.conversation, userId) === deletingConversationKey
                  }
                >
                  <span>
                    {Boolean(deletingConversationKey) &&
                    getConversationKey(contextMenu.conversation, userId) === deletingConversationKey
                      ? 'Removendo...'
                      : 'Apagar conversa!'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  function ConversationSidebar({
    conversations,
    userId,
    counterpartId,
    activeConversationKey,
    deletingConversationKey,
    onConversationClick,
    onContextMenu,
    onStartLongPress,
    onCancelLongPress,
    onCloseSidebar
  }) {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-xl shadow-slate-200/40 transition-all duration-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">Conversas</p>
            <p className="text-xs text-slate-500">Atualizado em tempo real</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-white/40 bg-white/50 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm shadow-slate-200 transition-all duration-200 hover:bg-white lg:hidden"
            onClick={onCloseSidebar}
          >
            Fechar
          </button>
        </div>
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
          {conversations.length === 0 ? (
            <p className="mt-10 text-center text-sm text-slate-400">Nenhuma conversa</p>
          ) : (
            conversations.map((conversation) => {
              const conversationKey = getConversationKey(conversation, userId);
              const conversationCounterpart = getConversationCounterpartId(conversation, userId);
              const normalizedConversationCounterpart =
                conversationCounterpart !== null && conversationCounterpart !== undefined
                  ? Number(conversationCounterpart)
                  : NaN;
              const normalizedCounterpart =
                counterpartId !== null && counterpartId !== undefined ? Number(counterpartId) : NaN;
              const fallbackActive =
                Number.isFinite(normalizedConversationCounterpart) &&
                Number.isFinite(normalizedCounterpart) &&
                normalizedConversationCounterpart === normalizedCounterpart;
              const isActive =
                (activeConversationKey && conversationKey === activeConversationKey) ||
                (!activeConversationKey && fallbackActive);
              const isDeleting =
                Boolean(deletingConversationKey) && deletingConversationKey === conversationKey;

              return (
                <ConversationCard
                  key={conversationKey || `conversation-${conversation.id}`}
                  conversation={conversation}
                  userId={userId}
                  isActive={isActive}
                  isDeleting={isDeleting}
                  onClick={() => onConversationClick(conversation)}
                  onContextMenu={onContextMenu}
                  onStartLongPress={onStartLongPress}
                  onCancelLongPress={onCancelLongPress}
                />
              );
            })
          )}
        </div>
      </div>
    );
  }

  function ConversationCard({
    conversation,
    userId,
    isActive,
    isDeleting,
    onClick,
    onContextMenu,
    onStartLongPress,
    onCancelLongPress
  }) {
    const isSender = userId && conversation.sender_id === userId;
    const counterpartName = isSender
      ? conversation.receiver_name || conversation.seller_name
      : conversation.sender_name || conversation.seller_name;
    const counterpartAvatar = isSender ? conversation.receiver_avatar : conversation.sender_avatar;
    const counterpartInitial = getInitial(counterpartName || 'SaleDay');
    const conversationTitle =
      conversation.product_title || (!conversation.product_id ? 'Conversa direta' : `Produto #${conversation.product_id}`);
    const previewOffer = parseOfferMessage(conversation.content);
    const previewResponse = parseOfferResponse(conversation.content);
    let previewText = conversation.content || 'Nova mensagem';
    if (previewOffer) {
      previewText = `Oferta: ${formatOfferAmount(previewOffer.amount, previewOffer.currency)}`;
    } else if (previewResponse) {
      previewText =
        previewResponse.status === 'accepted'
          ? 'Oferta aceita! Venda confirmada.'
          : 'Oferta recusada.';
    }
    const isUnread = Boolean(userId && conversation.receiver_id === userId && conversation.is_read === false);

    const handleContextMenu = (event) =>
      onContextMenu?.(event, { type: 'conversation', conversation });
    const handleTouchStart = (event) =>
      onStartLongPress?.(event, { type: 'conversation', conversation });

    return (
      <button
        type="button"
        onClick={onClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={onCancelLongPress}
        onTouchMove={onCancelLongPress}
        onTouchCancel={onCancelLongPress}
        disabled={isDeleting}
        className={`relative w-full rounded-[26px] border px-3 py-3 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 ${
          isActive
            ? 'border-blue-300 bg-blue-50 ring-1 ring-blue-200'
            : 'border-transparent bg-white hover:border-slate-200'
        } ${isDeleting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isUnread && (
          <span className="absolute top-3 right-3 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
        )}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 font-semibold text-blue-600 shadow-inner shadow-slate-200">
            {counterpartAvatar ? (
              <img
                src={counterpartAvatar}
                alt={counterpartName || 'Usuário SaleDay'}
                className="h-full w-full rounded-2xl object-cover"
                loading="lazy"
              />
            ) : (
              counterpartInitial
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{conversationTitle}</p>
            <p className="truncate text-xs text-slate-500">{counterpartName || 'Usuário SaleDay'}</p>
            <p className="truncate text-xs text-slate-600">{previewText}</p>
          </div>
        </div>
      </button>
    );
  }

  function AvatarBadge({ avatar, label, className = '' }) {
    return (
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700 overflow-hidden ${className}`}
      >
        {avatar ? (
          <img src={avatar} alt={label || 'Usuário SaleDay'} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span>{getInitial(label || 'SaleDay')}</span>
        )}
      </div>
    );
  }

  function ProductContextCard({ context }) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/90 p-4 shadow-sm shadow-slate-200/50 transition-all duration-200">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
          Produto em foco
        </p>
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {context.image ? (
              <img
                src={context.image}
                alt={context.title || 'Produto em foco'}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                Sem imagem
              </span>
            )}
          </div>
          <div className="flex-1 text-slate-900">
            <p className="text-sm font-semibold">{context.title || 'Produto em foco'}</p>
            {context.price && <p className="text-xs font-medium text-emerald-600">{context.price}</p>}
            {context.location && <p className="text-xs">{context.location}</p>}
          </div>
        </div>
      </div>
    );
  }

  function ProductPreview({ context }) {
    return (
      <div className="mx-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-4 shadow-sm shadow-blue-500/10 transition-all duration-200">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-blue-600">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            Prévia
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {context.image ? (
              <img
                src={context.image}
                alt={context.title || 'Produto em foco'}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                Sem imagem
              </span>
            )}
          </div>
          <div className="flex-1 text-slate-900">
            <p className="text-sm font-semibold">
              {context.title || `Produto #${context.productId}`}
            </p>
            {context.price && <p className="text-xs font-medium text-emerald-600">{context.price}</p>}
            {context.location && <p className="text-xs">{context.location}</p>}
          </div>
        </div>
      </div>
    );
  }

  function MessageBubble({ content, isSender }) {
    return (
      <div
        className={`flex-1 rounded-[26px] border border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-900 transition-all duration-200 ${
          isSender
            ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30'
            : 'bg-white shadow-inner shadow-slate-200'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>
    );
  }

  function OfferBubble({
    offerData,
    response,
    offerMessage,
    isSender,
    isSeller,
    productSold,
    respondToOffer,
    respondingOfferId
  }) {
    const responseStatus = response?.status;
    const isAccepted = responseStatus === 'accepted';
    const awaitingSellerAction = !response && isSeller && !isSender && !productSold;
    const awaitingBuyer = !response && isSender;

    return (
      <div
        className={`flex-1 rounded-[28px] border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-lg shadow-slate-200/60 transition-all duration-200`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Proposta enviada</p>
          <span className="text-sm font-semibold text-slate-900">
            {formatOfferAmount(offerData.amount, offerData.currency)}
          </span>
        </div>
        {offerData.message && <p className="mt-2 text-sm leading-relaxed">{offerData.message}</p>}
        <div className="mt-3 flex flex-col gap-2">
          {responseStatus && (
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                isAccepted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'
              }`}
            >
              {isAccepted ? 'Oferta aceita! Venda confirmada.' : 'Oferta recusada.'}
            </span>
          )}

          {awaitingSellerAction && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => respondToOffer(offerMessage, 'accept')}
                disabled={respondingOfferId === offerMessage?.id}
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
              >
                {respondingOfferId === offerMessage?.id ? 'Confirmando...' : 'Aceitar'}
              </button>
              <button
                type="button"
                onClick={() => respondToOffer(offerMessage, 'decline')}
                disabled={respondingOfferId === offerMessage?.id}
                className="rounded-full bg-rose-200 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-300 disabled:opacity-60"
              >
                {respondingOfferId === offerMessage?.id ? 'Atualizando...' : 'Não aceitar'}
              </button>
            </div>
          )}

          {awaitingBuyer && (
            <span className="text-xs font-medium text-slate-500">
              Aguardando resposta do vendedor...
            </span>
          )}
        </div>
      </div>
    );
  }

  function MobileSidebar({ open, onClose, children }) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-50 lg:hidden">
        <div
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />
        <div className="relative mx-auto h-full w-full max-w-xs">
          <div
            className="absolute inset-x-4 top-[calc(var(--home-header-height,64px)+1rem)] h-[calc(100vh-var(--home-header-height,64px)-2rem)] transition-transform duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    );
  }
