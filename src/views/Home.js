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

    useEffect(() => {
        const scrollContainer = document.querySelector('.horizontal-scroll-container');
        scrollContainer.addEventListener('scroll', handleCarouselScroll);

        return () => {
            scrollContainer.removeEventListener('scroll', handleCarouselScroll);
        };
    }, []);

    useEffect(() => {
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

            // const transactionSubscription = createSubscription('transactions', 'public', user.id, handleTransactionUpdated);
            // const offerSubscription = createSubscription('offers', 'public', user.id, handleOfferUpdated);


            const subscription = supabase
                .channel('any')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, handleTransactionUpdated)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, handleOfferUpdated)
                .subscribe()

            console.log('Subscription created for user:', user.user_id);


            return () => {
                subscription.unsubscribe();
            };
        }
    }, [user]);




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
        if (event.new && ['INSERT', 'UPDATE'].includes(event.eventType)) fetchTransactions(user.user_id);
    };

    const handleOfferUpdated = async (event) => {
        console.log('Handling offer updated:', event); // Debug log to see what the event object contains

        if (event.eventType === 'INSERT') {
            fetchOfferCards(user.user_id);
            const { new: newOffer } = event;
            console.log('New offer:', newOffer); // Debug log for the new offer

            if (newOffer.referral_uid) {

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
        const { data, error } = await supabase
            .from('offers')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });


        if (data) {
            const offersWithInviterDetails = await Promise.all(
                data.map(async offer => {
                    if (offer.referral_uid) {

                        console.log('here');
                        const { data: inviter, error } = await supabase
                            .from('users')
                            .select('*')
                            .eq('user_id', user.invited_by)
                            .single()
                        offer.inviter = inviter;
                    }
                    return offer;
                })
            );
            setOfferCards(offersWithInviterDetails);
        } else {
            setOfferCards([]);
        }

        if (error) {
            console.error('Error fetching offers:', error);
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

        const backgroundImage = `url('https://source.unsplash.com/random?sig=${index}')`;

        switch (card.type) {
            case 'loyal':
                return (
                    <div className="hero-card" key={index} style={{ backgroundImage }}>
                        <div dangerouslySetInnerHTML={{ __html: tcwLogo }} />
                        <h1>{card.value !== null ? `₹${card.value.toFixed(2)}` : ''}</h1>
                        <QRCodeCanvas className="qr-code" size={720} value={card.id} includeMargin />
                    </div>
                );
            case 'invite':
                return (
                    <div key={index} className="hero-card" style={{ backgroundImage }}>
                        <img src={card.inviter?.avatar_url} alt="" />
                        <p>{card.inviter ? card.inviter.full_name : ''}</p>
                        <p>{card.type}</p>
                        <QRCodeCanvas className="qr-code" size={720} value={card.id} includeMargin />
                    </div>
                );
            case 'refer':
                return (
                    <div key={index} className="hero-card" style={{ backgroundImage }}>
                        <img src={card.image} alt="" />
                        <p>{card.type}</p>
                        <QRCodeCanvas className="qr-code" size={720} value={card.id} style={{ filter: card.is_unlocked ? 'none' : 'blur(10px)' }} includeMargin />
                    </div>
                );
            default:
                return <div key={index} className="hero-card" style={{ backgroundImage }}>Error</div>;
        }
    };


    return (
        <div className="styled-container"><div className='navbar'><div dangerouslySetInnerHTML={{ __html: nomsterSVG }} />
        </div>
            <div className="horizontal-scroll-container">
                {offerCards.map(renderCard)}
                <div className="hero-card" onClick={handleShareOffer}>
                    <div dangerouslySetInnerHTML={{ __html: offerSVG }} />
                </div>
            </div>
            <ul className='list'>
                {transactions.map((transaction) => (
                    <li key={transaction.id} style={{ listStyleType: 'none' }}>
                        <div className='list-item'  >
                            <div className='wallet-balance'>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ backgroundColor: '#eee', borderRadius: '100px' }}><p style={{ fontSize: '32px', textAlign: 'center', height: '40px', width: '40px', borderRadius: '100px', padding: '2px' }}> {transaction.type == 'earn' ? '↓' : transaction.type == 'refer' ? '🥤' : transaction.type == 'invite' ? '🥤' : '↑'}</p>
                                    </div> <div><p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{transaction.type}</p> <p style={{ color: 'gray' }}>{formatDate(transaction.created_at)}</p>
                                    </div>
                                </div>
                                <p>{renderTransactionAmount(transaction)}</p></div>


                        </div>
                    </li>
                ))}
            </ul>
            <button className='secondary-button' onClick={handleSignOut}>Sign out</button>

        </div >
    );
}

export default Home;

