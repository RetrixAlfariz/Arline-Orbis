import { mount } from 'svelte';
import App from './app/App.svelte';
import './app/studio.css';
import './app/celestial.css';

mount(App, { target: document.getElementById('app')! });
