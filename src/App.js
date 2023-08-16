import React, { useState, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate, Navigate } from 'react-router-dom';
import Login from './views/Login.js';
import Home from './views/Home.js';
import { createClient } from '@supabase/supabase-js';
import { indigo } from '@mui/material/colors';
import Admin from './views/Admin.js';
import Billing from './views/Billing.js';
import mixpanel from 'mixpanel-browser';
import Privacy from './views/Privacy.js';
import Tos from './views/Tos.js';

const MIXPANEL_TOKEN = '9937813cca9141bdb4adf8b6a5345d44'; // Replace with your Mixpanel project token


mixpanel.init(MIXPANEL_TOKEN, { debug: true, track_pageview: true, persistence: 'localStorage' });



const supabaseUrl = "https://xxsawwpbahvabbaljjuu.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4c2F3d3BiYWh2YWJiYWxqanV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTE3NDIxMDIsImV4cCI6MjAwNzMxODEwMn0.WX8Px7pOFPcR9jX7HEv9bQPeuMrfaWzYMQPJut--W9s"

export const supabase = createClient(supabaseUrl, supabaseKey);



function App() {




  return (
    <BrowserRouter basename={process.env.PUBLIC_URL}>
      <Routes>
        <Route exact path='/' element={<Login />} />
        <Route exact path='' element={<Navigate to="/" />} />
        <Route path='/home' element={<Home />} />
        <Route path='/admin' element={<Admin />} />
        <Route path='/billing' element={<Billing />} />
        <Route path='/privacy' element={<Privacy />} />
        <Route path='/tos' element={<Tos />} />
      </Routes>
    </BrowserRouter>

  );
}

export default App;
