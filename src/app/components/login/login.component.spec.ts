import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NgModule } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';

import { LoginComponent } from './login.component';
import { FormsModule } from '@angular/forms';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, FormsModule, RouterTestingModule],
      declarations: [LoginComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // Mock localStorage
    const mockLocalStorage = {
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should login successfully and navigate to /chat', () => {
    const mockResponse = { user: { username: 'testuser' } };
    const mockNavigate = jest.fn();
    component['router'].navigate = mockNavigate;

    component.emailOrUsername = 'testuser';
    component.password = 'password123';
    component.loginUser();

    const req = httpMock.expectOne('http://localhost:5000/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockResponse.user));
    expect(localStorage.setItem).toHaveBeenCalledWith('currentUser', 'testuser');
    expect(mockNavigate).toHaveBeenCalledWith(['/chat']);
  });

  it('should handle invalid server response', () => {
    const mockResponse = {};

    component.emailOrUsername = 'testuser';
    component.password = 'password123';
    component.loginUser();

    const req = httpMock.expectOne('http://localhost:5000/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);

    expect(component.errorMessage).toBe('Invalid response from server');
  });

  it('should handle login error with default error message', () => {
    const mockError = {};

    component.emailOrUsername = 'testuser';
    component.password = 'wrongpassword';
    component.loginUser();

    const req = httpMock.expectOne('http://localhost:5000/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockError, { status: 500, statusText: 'Internal Server Error' });

    expect(component.errorMessage).toBe('Invalid email or password');
  });
});
