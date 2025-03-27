import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { ChatComponent } from './components/chat/chat.component';

const routes: Routes = [
  {
    path: 'register',
    component: RegisterComponent
  },
  { 
    path: 'login', 
    component: LoginComponent
  },
  { 
    path: 'chat',
    component: ChatComponent
  },
  { 
    path: '',
    pathMatch: 'full', 
    redirectTo: 'login'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
