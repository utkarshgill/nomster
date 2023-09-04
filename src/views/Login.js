import React, { useEffect, useState } from 'react';

import mixpanel from 'mixpanel-browser';
import { supabase } from '../App';
import svgData from './svgData';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStatus } from '../models/GlobalState';


import QRCodeCanvas from 'qrcode.react';


function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const inviteCode = new URLSearchParams(location.search).get('i');
  const offerType = new URLSearchParams(location.search).get('o');
  const [offerImage, setOfferImage] = useState(null);
  const [inviterName, setInviterName] = useState(null);
  const [inviterImage, setInviterImage] = useState(null);
  const { setStatus } = useStatus();

  useEffect(() => {
    (async () => {
      if (inviteCode) {
        const { data: inviterData } = await supabase
          .from('users')
          .select('full_name, avatar_url')
          .eq('user_id', inviteCode).single();

        if (inviterData) {
          setInviterName(inviterData.full_name);
          setInviterImage(inviterData.avatar_url);
          if (offerType) {
            const { data } = await supabase
              .from('offer_types')
              .select('image')
              .eq('type', offerType).single();

            if (data) {
              setOfferImage(data.image);
            }
          }
        } else {
          navigate('/');
        }
      }
    })();
  }, [offerType, inviteCode, navigate]);
  useEffect(() => {
    (async () => {
      if (offerType) {
        const { data } = await supabase
          .from('offer_types')
          .select('image')
          .eq('type', offerType).single();

        if (data) {
          setOfferImage(data.image);
        }
      }
    })();
  }, [offerType]);

  // Check if the user is already authenticated
  useEffect(() => {
    (async () => {

      const { data: { user } } = await supabase.auth.getUser()
      if (user) navigate('/home');
    })();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    mixpanel.track("tap sign in", { "method": "google" });
    if (inviteCode) {
      sessionStorage.setItem('invite_code', inviteCode);
      if (offerType) {
        sessionStorage.setItem('offer_type', offerType);
      }

    }
    // let { user, error } = await supabase.auth.signInWithOtp({
    //   phone: '+918267067782',
    // });

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: '/home',
        scopes: 'email profile openid'
      }
    });
  };

  const handleUserSignIn = async (user, storedInviteCode, storedOfferType) => {
    // Check if the user is new by querying the users table
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user?.id);

    mixpanel.identify(user?.id);


    if (!data?.length) {
      storedInviteCode ? mixpanel.track('sign up', { type: 'invite' }) : mixpanel.track('sign up')
      // Create a record in Supabase users table
      await supabase.from('users').insert([
        {
          user_id: user?.id,
          full_name: user?.user_metadata?.full_name,
          avatar_url: user?.user_metadata?.avatar_url,
          email: user?.email,
          invited_by: storedInviteCode,
          is_activated: false,
          balance: 0,
        },
      ]);


      // If invite code exists, create an offer with type INVITE and referral_uid = inviteCode
      if (storedInviteCode) {
        console.log(storedOfferType);
        if (storedOfferType) {
          const { data: offerData } = await supabase
            .from('offer_types')
            .select('*')
            .eq('type', storedOfferType).single();

          console.log(offerData);// After the insertion is done
          setStatus('inserting');

          if (offerData.type == 'invite') {
            const { data, error } = await supabase.from('offers').insert([
              {
                user_id: storedInviteCode,
                type: 'refer',
                is_unlocked: false,
                referral_uid: user.id,
                value: offerData.value,
                image: offerData.image,
                name: offerData.name
              }
            ]).select().single();
            await supabase.from('offers').insert([
              {
                user_id: user?.id,
                type: 'invite',
                ref_offer_id: data.id,
                referral_uid: storedInviteCode,
                value: offerData.value,
                image: offerData.image,
                name: offerData.name
              }
            ]);
          }
          else if (offerData.type == 'scan') {

            await supabase.from('offers').insert([
              {
                user_id: user?.id,
                type: offerData.type,
                ref_offer_id: storedInviteCode,
                value: offerData.value,
                image: offerData.image,
                name: offerData.name
              }
            ]);
          }


          else {

            // console.log(1);
            // await supabase.from('offers').insert([
            //   {
            //     user_id: user?.id,
            //     type: 'invite',
            //     referral_uid: storedInviteCode
            //   }
            // ]);
          }
        }
        // else {
        //   console.log(2);
        //   const { data, error } = await supabase.from('offers').insert([
        //     {
        //       user_id: storedInviteCode,
        //       type: 'refer',
        //       is_unlocked: false
        //     }
        //   ]).select().single();

        //   console.log("Inserted refer data:", data); // Log the data to see its structure


        //   await supabase.from('offers').insert([
        //     {
        //       user_id: user?.id,
        //       type: 'invite',
        //       referral_uid: data.id
        //     }
        //   ]);
        // }
        setStatus('completed');

      }
    }
  };

  // Listen for the login event
  useEffect(() => {
    const sessionListener = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN') {
          const user = session?.user;
          // Retrieve the invite code from session storage
          const storedInviteCode = sessionStorage.getItem('invite_code');
          const storedOfferType = sessionStorage.getItem('offer_type');
          sessionStorage.removeItem('invite_code'); // Optionally, clear it after retrieval
          sessionStorage.removeItem('offer_type'); // Optionally, clear it after retrieval


          await handleUserSignIn(user, storedInviteCode, storedOfferType);
          mixpanel.track('sign in');
          // Navigate to home
          navigate('/home');
        }
      }
    );

    return () => {
      sessionListener.data.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className='styled-container' >

      <span style={{ display: 'flex', fontSize: '48px', alignItems: 'center', margin: '60px 0 0 0' }}>🥤🍕
        <div dangerouslySetInnerHTML={{ __html: svgData.nomster }} />🍔🍟 </span>

      <div style={{ maxWidth: '80%' }}>
        <h1 style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '60px', lineHeight: '.85', margin: '0 0 20px 0' }}>
          rewards on every bite!
        </h1>
        <p style={{ textAlign: 'center' }}>nomster is your ultimate restaurant loyalty companion: earn cashback, invite friends, and unlock exciting rewards</p>

      </div>

      <button className='scanner' onClick={handleGoogleSignIn}>Continue with Google</button>



      <div style={{ width: '100%' }}>
        <h4 className='label' style={{ textAlign: 'center' }}>Sign in to unlock offers</h4>



        <div className='balance-card' style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <p className='label'>on all orders</p>
          <h1 style={{ textAlign: 'left' }}>10% cashback</h1>

        </div>
        {inviterName && inviterImage ? (
          <div className="offer-card" style={{ background: '#ffdd8e' }}>


            {/* <img style={{ borderRadius: '100px', width: '24px' }} src={imgUrl} alt="" /> */}
            <div>
              <p className='label' >{`${inviterName} invited you`}</p>
              <h1 style={{ textAlign: 'left' }}>FREEDRINK</h1>

            </div>

          </div>

        ) : ''}
        <div className='balance-card invite-friends' style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <p className='label'> on all orders above ₹199</p>
          <h1 style={{ textAlign: 'left' }}>invite a friend, grab a drink</h1>

        </div>
      </div>
      <div style={{ width: '100%' }}>
        <h4 className='label' style={{ textAlign: 'center' }}>How it works</h4>

        <div className='balance-card' style={{ flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ textAlign: 'left', width: '100%' }}><span style={{ fontWeight: 'normal' }}>Step 1</span><br />Dine at Your Favorite Restaurant</h2>
          <p>Visit any restaurant of your choice and enjoy your meal. Whether it's a brunch, lunch, or dinner, savor every moment.</p>
        </div><div className='offer-card' style={{ flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ textAlign: 'left', width: '100%' }}><span style={{ fontWeight: 'normal' }}>Step 2</span><br />Enter the Bill & Select an Offer</h2>
          <p>After finishing, open the Nomster app. Input the total bill amount and explore our curated list of exclusive offers. Select the one that appeals to you the most.</p>

        </div><div className='balance-card invite-friends' style={{ flexDirection: 'column', gap: '12px', background: '#ffdd8e' }}>
          <h2 style={{ textAlign: 'left', width: '100%' }}><span style={{ fontWeight: 'normal' }}>Step 3</span><br />Instantly Claim Your Cashback</h2>
          <p>With the offer selected, tap to claim and enjoy instant cashback. Savings made simple, every time you dine.</p>
        </div>
      </div>
      <footer className='footer'>

        <a href="/tos">Terms of Service</a>
        <a href="https://twitter.com/nomsterindia" target="_blank" rel="noopener noreferrer">Twitter</a>
        <a href="/privacy">Privacy Policy</a>

      </footer>
    </div >
  );
}

export default Login;
