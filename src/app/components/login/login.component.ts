

import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  emailOrUsername: string = '';
  password: string = '';
  errorMessage: string = '';

  constructor(private http: HttpClient, private router: Router) {}

  loginUser() {
    this.http.post<any>('http://localhost:5000/login', { emailOrUsername: this.emailOrUsername, password: this.password })
      .subscribe(
        response => {
          if (response && response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.setItem('currentUser', response.user.username);
            console.log('User info stored:', response.user);
            this.router.navigate(['/chat']);
          } else {
            this.errorMessage = 'Invalid response from server';
          }
        },
        error => {
          this.errorMessage = error.error.error || 'Invalid email or password';
          console.error('Login error:', error);
        }
      );
  }
}
