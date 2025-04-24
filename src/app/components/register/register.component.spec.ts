import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NgModule } from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { RegisterComponent } from './register.component';
import { FormsModule } from '@angular/forms';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule],
      declarations: [RegisterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should register user successfully and navigate to /chat', () => {
    const mockResponse = { user: { id: 1, email: 'test@example.com', username: 'testuser' } };
    jest.spyOn(component['http'], 'post').mockReturnValue(of(mockResponse));

    component.email = 'test@example.com';
    component.password = 'password123';
    component.username = 'testuser';
    component.registerUser();

    expect(component['http'].post).toHaveBeenCalledWith('http://localhost:5000/register', {
      email: 'test@example.com',
      password: 'password123',
      username: 'testuser'
    });
    expect(localStorage.getItem('user')).toEqual(JSON.stringify(mockResponse.user));
    expect(router.navigate).toHaveBeenCalledWith(['/chat']);
  });

  it('should handle registration error and set errorMessage', () => {
    const mockError = { error: { error: 'Email already exists' } };
    jest.spyOn(component['http'], 'post').mockReturnValue(throwError(() => mockError));

    component.email = 'test@example.com';
    component.password = 'password123';
    component.username = 'testuser';
    component.registerUser();

    expect(component['http'].post).toHaveBeenCalledWith('http://localhost:5000/register', {
      email: 'test@example.com',
      password: 'password123',
      username: 'testuser'
    });
    expect(component.errorMessage).toEqual('Email already exists');
  });

  it('should set default errorMessage if error response does not contain error field', () => {
    const mockError = { error: {} };
    jest.spyOn(component['http'], 'post').mockReturnValue(throwError(() => mockError));

    component.email = 'test@example.com';
    component.password = 'password123';
    component.username = 'testuser';
    component.registerUser();

    expect(component.errorMessage).toEqual('Registration failed');
  });

  afterEach(() => {
    httpMock.verify();
  });
});
