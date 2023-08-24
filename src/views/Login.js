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
          email: user?.email, invited_by: storedInviteCode,
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
                type: offerData.type,
                referral_uid: data.id,
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
                referral_uid: storedInviteCode,
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
    <div className='styled-container' style={{ height: '100vh', justifyContent: 'center' }}>

      <div className='navbar'>
        <div dangerouslySetInnerHTML={{ __html: svgData.nomster }} />
      </div>

      {inviterName && inviterImage ? (
        <div className='stack-h-fill' style={{ gap: '12px' }}>
          <img style={{ borderRadius: '100px', width: '32px' }} src={inviterImage} alt={inviterName} />
          <span>{`${inviterName} sent you a drink`}</span>
        </div>
      ) : ''}
      {offerImage && inviterName ? <div style={{
        display: 'flex',
        alignItems: 'end',
        justifyContent: 'center',
        boxSizing: 'border-box',
        padding: '80px',
        marginBottom: '10px',

        position: 'relative',
        backgroundImage: `url(${offerImage})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        aspectRatio: '1280/1792'
      }}>

        <QRCodeCanvas fgColor='#2B1317' className='qr-code' value={inviterName} includeMargin style={{ filter: 'blur(10px)' }} />

      </div> : <div />}
      <button className='scanner' onClick={handleGoogleSignIn}>Continue with Google</button>
      <footer className='footer'>
        <nav>
          <a href="/tos">Terms of Service</a>
          <a href="https://twitter.com/nomsterindia" target="_blank" rel="noopener noreferrer">Twitter</a>
          <a href="/privacy">Privacy Policy</a>
        </nav>
      </footer>
    </div >
  );
}

export default Login;
