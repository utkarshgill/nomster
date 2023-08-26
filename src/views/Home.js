import React, { useState, useEffect } from 'react';
import { supabase } from '../App';
import { useNavigate } from 'react-router-dom';
import QRCodeCanvas from 'qrcode.react';
import mixpanel from 'mixpanel-browser';
import svgData from './svgData';
import './styles.scss';
import { useStatus } from '../models/GlobalState';


function Home() {
    const navigate = useNavigate();
    const { offer: offerSVG, nomster: nomsterSVG, tcwLogo } = svgData;
    const [user, setUser] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [offerCards, setOfferCards] = useState([]);

    const { status } = useStatus();

    useEffect(() => {
        if (status === 'completed') {
            fetchOfferCards(user.user_id);
        }
    }, [user, status]);

    const handleCarouselScroll = () => {
        if (user) {
            mixpanel.track('scroll offer', { user_id: user.user_id });
            document.querySelector('.horizontal-scroll-container').removeEventListener('scroll', handleCarouselScroll);

        }
    };

    // useEffect(() => {
    //     const scrollContainer = document.querySelector('.horizontal-scroll-container');
    //     // scrollContainer.addEventListener('scroll', handleCarouselScroll);

    //     return () => {
    //         scrollContainer.removeEventListener('scroll', handleCarouselScroll);
    //     };
    // }, []);
    const fetchUser = async () => {
        console.log('Fetching user...'); // Debug log before fetching user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('user_id', user.id).single();
            console.log('User fetched:', userData); // Debug log for fetched user
            setUser(userData);
        } else {
            console.log('No user found, redirecting...'); // Debug log if no user is found
            navigate('/');
        }
    };

    useEffect(() => {

        fetchUser();
    }, []);

    useEffect(() => {
        if (user) {
            console.log('User state updated, creating subscriptions:', user); // Debug log for updated user state

            fetchOfferCards(user.user_id);
            fetchTransactions(user.user_id);
        }
    }, [user]);


    useEffect(() => {
        if (user) {
            console.log('Creating subscription for user:', user.user_id); // Debug log for subscription creation

            const filterString = `user_id=eq.${user.user_id}`;

            const subscription = supabase
                .channel('any')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: filterString }, handleTransactionUpdated)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'offers', filter: filterString }, handleOfferUpdated)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: filterString }, handleUserUpdated)
                .subscribe()

            console.log('Subscription created for user:', user.user_id);

            return () => {
                subscription.unsubscribe();
            };
        }
    }, [user]);


    const handleUserUpdated = (event) => {
        if (event.new) {
            setUser(event.new);//
        }
    }


    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/');
        setUser(null);
    };



    const fetchTransactions = async (userId) => {
        const { data, error } = await supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (data) setTransactions(data);
        if (error) console.error('Error fetching transactions:', error);
    };

    const handleTransactionUpdated = (event) => {
        console.log('new');
        if (user && event.new && ['INSERT', 'UPDATE'].includes(event.eventType)) fetchTransactions(user.user_id);
    };

    const handleOfferUpdated = async (event) => {
        console.log('Handling offer updated:', event); // Debug log to see what the event object contains

        if (event.eventType === 'INSERT') {
            fetchOfferCards(user.user_id);
            const { new: newOffer } = event;
            console.log('New offer:', newOffer); // Debug log for the new offer

            if (newOffer.referral_uid && user) {

                const { data: inviterDetails } = await supabase
                    .from('users')
                    .select('*')
                    .eq('user_id', user.invited_by)
                    .single();

                console.log(inviterDetails.full_name)
                newOffer.inviter = inviterDetails;


                console.log('New offer with inviter:', newOffer); // Debug log for the new offer with inviter details
            }

            setOfferCards(currentOfferCards => {
                console.log('Current offer cards:', currentOfferCards); // Debug log for the current offer cards before updating
                const updatedOfferCards = [...currentOfferCards, newOffer];
                console.log('Updated offer cards:', updatedOfferCards); // Debug log for the updated offer cards after adding the new offer
                return updatedOfferCards;
            });
        } else if (event.eventType === 'UPDATE') {
            fetchOfferCards(user.user_id);
        }
    };

    const fetchOfferCards = async (userId) => {
        if (user) {
            const { data, error } = await supabase
                .from('offers')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });


            if (data) {
                console.log(data);
                const offersWithInviterDetails = await Promise.all(
                    data.map(async offer => {
                        if (offer && user) {
                            if (offer.type == 'invite') {

                                console.log('here');
                                const { data: inviter, error } = await supabase
                                    .from('users')
                                    .select('*')
                                    .eq('user_id', user.invited_by)
                                    .single()

                                offer.inviter = inviter;
                            } else if (offer.type = 'refer') {
                                const { data: ref, error } = await supabase
                                    .from('users')
                                    .select('*')
                                    .eq('user_id', offer.referral_uid)
                                    .single()
                                offer.ref = ref;
                            }
                            return offer;
                        }

                    })
                );
                setOfferCards(offersWithInviterDetails);
            } else {
                setOfferCards([]);
            } if (error) {
                console.error('Error fetching offers:', error);
            }
        }



    };


    const updateOffers = (event) => {
        const { new: updatedOffer, eventType } = event;
        setOfferCards(currentOfferCards => {
            if (eventType === 'INSERT') return [...currentOfferCards, updatedOffer];
            if (eventType === 'UPDATE') return currentOfferCards.map(card => (card.id === updatedOffer.id ? { ...updatedOffer } : card));
            return [...currentOfferCards];
        });
    };


    const formatDate = (dateString) => {
        const options = { day: 'numeric', month: 'short' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const renderTransactionAmount = (transaction) => (
        <span style={{ color: transaction.amount < 0 ? 'grey' : 'green', fontWeight: 'bold' }}>
            {transaction.amount < 0 ? `- ₹${Math.abs(transaction.amount).toFixed(2)}` : `+ ₹${Math.abs(transaction.amount).toFixed(2)}`}
        </span>
    );

    const handleShareOffer = () => {
        const referralUrl = `https://nomster.in/?i=${user.user_id}&o=invite`;
        const shareMessage = `Can't espresso how awesome you are, here's a *FREE* coffee for you 👉 ${referralUrl}`;

        mixpanel.track('tap share offer', { user_id: user.user_id });
        if (navigator.share) {
            navigator.share({ title: 'Invite Friends', text: shareMessage, url: referralUrl })
                .then(() => {
                    alert('Shared successfully!');
                    mixpanel.track('share offer successful', { user_id: user.user_id });
                })
                .catch(error => console.error('Error sharing:', error));
        }
    };




    const renderCard = (card, index) => {
        if (card.is_used) return null;

        const imgUrl = card.type === 'invite' ? card.inviter?.avatar_url : card.ref?.avatar_url;
        const name = card.type === 'invite' ? card.inviter?.full_name : card.ref?.full_name;

        const firstName = name.split(' ')[0];

        return (
            <div key={index} className="offer-card" >

                {
                    card.type === 'invite' || card.type === 'refer' ?
                        <label htmlFor={`offer-${index}`}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'end',
                                justifyContent: 'center',
                                boxSizing: 'border-box',
                                padding: '80px',
                                marginBottom: '10px',

                                position: 'relative',
                                backgroundImage: `url(${card.image})`,
                                backgroundSize: 'cover',
                                backgroundRepeat: 'no-repeat',
                                aspectRatio: '1280/1792'
                            }}>

                                <QRCodeCanvas fgColor='#2B1317' className='qr-code' value={user?.user_id + '&' + card.type + '%' + card.id} includeMargin style={card.type === 'refer' && !card.is_unlocked ? { filter: 'blur(10px)' } : {}} />

                            </div>


                            <div className='stack-h-fill'>
                                <p>{card.type == 'invite' ? `Because ${firstName} invited you` : card.type === 'refer' && !card.is_unlocked ? `Because you invited ${firstName} (Unlocks after their first order)` : card.type == 'refer' && card.is_unlocked ? `Because you invited ${firstName}` : {}}</p>
                                <img style={{ borderRadius: '100px', width: '24px' }} src={imgUrl} alt="" />
                            </div>
                        </label> : ''
                }
            </div>
        );
    };




    const BalanceCard = () => (
        <div className="offer-card balance-card"  >


            <p>C A S H B A C K</p>
            <h1>{user?.balance && `₹${user?.balance?.toFixed(2)}`}</h1>

            <QRCodeCanvas fgColor='#2B1317' value={user?.user_id + '&spend' + '%cardID'} includeMargin className='qr-code'></QRCodeCanvas>

            <p>Get 10% cashback on every transaction</p>

        </div >
    );












    const renderTransactions = (transactions) => {
        return transactions.map(({ id, type, created_at, amount, is_confirmed }, i) => (
            <li key={id} style={{ listStyleType: 'none' }}>
                <div className='list-item'>
                    <div className='wallet-balance'>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ backgroundColor: '#fff', borderRadius: '100px', border: '2px solid #000' }}>
                                <p style={{ fontSize: '32px', textAlign: 'center', height: '40px', width: '40px', borderRadius: '100px', padding: '2px' }}>
                                    {type == 'earn' ? '₹' : type == 'refer' || type == 'invite' ? '🥤' : '₹'}</p>
                            </div>
                            <div>
                                <p style={{ fontWeight: 'bold', marginBottom: '4px' }}> {type == 'spend' ? `Saved ₹${amount} on bill` : type == 'earn' ? `Earned ₹${amount} cashback` : (type == 'invite' || type == 'refer') ? `You got a FREE drink` : ''}</p>
                                <p style={{ color: 'gray' }}>{formatDate(created_at)}</p>
                            </div>
                        </div>
                        {!is_confirmed && <p style={{ color: 'gray', fontStyle: 'italic', color: 'brown' }}>Processing</p>}
                    </div>
                </div>
            </li>
        ));
    };



    const handleClick = (url) => {
        window.open(url, '_blank');
    }

    return (
        <div className="styled-container">
            <div className='navbar'>
                <div dangerouslySetInnerHTML={{ __html: svgData.nomster }} />
            </div>
            <BalanceCard />
            {offerCards.map(renderCard)}
            <div className="offer-card" onClick={handleShareOffer}><img style={{ width: '100%' }} src={'https://xxsawwpbahvabbaljjuu.supabase.co/storage/v1/object/public/images/invite_friends.png'} /></div>
            <ul className='list'>{renderTransactions(transactions)}</ul>
            <div className='hero-card' style={{ alignItems: 'center', }}>
                <div dangerouslySetInnerHTML={{ __html: tcwLogo }} />
                <h2 style={{ textAlign: 'center' }}>{'Visit The Country Wok, Nizampura, Vadodara to claim your rewards 🎁'}
                </h2>  <button className='secondary-button' onClick={() => handleClick('https://goo.gl/maps/ssxsgRkP3Q8EES979')}>Directions</button>
                <button className='secondary-button' onClick={() => handleClick('https://link.zomato.com/xqzv/rshare?id=318626019a7b92f9')}>Order on Zomato</button>
                <button className='secondary-button' onClick={() => handleClick('https://www.swiggy.com/menu/460656')}>Order on Swiggy</button>

                <a href={`tel:${'+918199079413'}`} className='secondary-button' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Call us at 8199079413</a>
            </div>
            <button className='secondary-button' onClick={handleSignOut}>Sign out</button>
            <footer className='footer'>
                <nav>
                    <a href="/tos">Terms of Service</a>
                    <a href="https://twitter.com/nomsterindia" target="_blank" rel="noopener noreferrer">Twitter</a>
                    <a href="/privacy">Privacy Policy</a>
                </nav>
            </footer>
        </div>
    );




}

export default Home;

