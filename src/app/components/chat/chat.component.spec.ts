import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';

import { ChatComponent } from './chat.component';
import { ChatService } from '../../services/chat.service';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;
  let mockChatService: Partial<ChatService>;

  beforeEach(async () => {
    // Mock localStorage
    const mockLocalStorage = {
      getItem: jest.fn().mockReturnValue('testUser'),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn()
    };
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

    mockChatService = {
      initializeSocket: jest.fn(),
      disconnect: jest.fn(),
      getMessages: jest.fn().mockReturnValue(of([])),
      getTypingStatus: jest.fn().mockReturnValue(of({ isTyping: false, user: '' })),
      getOnlineUsers: jest.fn().mockReturnValue(of([])),
      getUsers: jest.fn().mockReturnValue(of([])),
      getGroups: jest.fn().mockReturnValue(of([])),
      markMessagesAsRead: jest.fn().mockReturnValue(of({})),
      getGroupChatHistory: jest.fn().mockReturnValue(of([])),
      sendPrivateMessage: jest.fn(),
      sendGroupMessage: jest.fn(),
      createGroup: jest.fn().mockReturnValue(of({})),
      addUserToGroup: jest.fn().mockReturnValue(of({})),
      getUnreadMessageCount: jest.fn().mockReturnValue(of({ unreadCount: 0 })),
      getGroupUnreadCount: jest.fn().mockReturnValue(of({ unreadCount: 0 })),
      emitTyping: jest.fn(),
      emitGroupTyping: jest.fn(),
      getChatHistory: jest.fn().mockReturnValue(of([])),
      markGroupMessagesAsRead: jest.fn().mockReturnValue(of({}))
    };

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      declarations: [ChatComponent],
      providers: [{ provide: ChatService, useValue: mockChatService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize component with current user', () => {
    component.ngOnInit();
    expect(component.currentUser).toBe('testUser');
    expect(mockChatService.initializeSocket).toHaveBeenCalledWith('testUser');
    expect(mockChatService.getMessages).toHaveBeenCalled();
    expect(mockChatService.getUsers).toHaveBeenCalled();
    expect(mockChatService.getGroups).toHaveBeenCalled();
  });

  it('should cleanup on destroy', () => {
    component.ngOnDestroy();
    expect(mockChatService.disconnect).toHaveBeenCalled();
  });

  it('should toggle chat visibility and reset unread count when opened', () => {
    component.isOpen = false;
    component.totalUnreadCount = 5;

    component.toggleChat();
    expect(component.isOpen).toBe(true);
    expect(component.totalUnreadCount).toBe(0);

    component.toggleChat();
    expect(component.isOpen).toBe(false);
  });

  it('should toggle between users and groups view', () => {
    component.viewMode = 'groups';
    component.toggleToUsers();
    expect(component.viewMode).toBe('users');
    expect(component.selectedGroup).toBeNull();

    component.viewMode = 'users';
    component.toggleToGroups();
    expect(component.viewMode).toBe('groups');
    expect(component.selectedUser).toBeNull();
  });

  it('should send private message', () => {
    component.selectedUser = 'testUser';
    component.message = 'Hello';
    component.sendMessage();
    expect(mockChatService.sendPrivateMessage).toHaveBeenCalledWith('testUser', 'Hello');
    expect(component.message).toBe('');
  });

  it('should send group message', () => {
    component.selectedGroup = { name: 'testGroup', members: [] };
    component.message = 'Hello Group';
    component.sendMessage();
    expect(mockChatService.sendGroupMessage).toHaveBeenCalledWith('testGroup', 'Hello Group');
    expect(component.message).toBe('');
  });

  it('should create group', () => {
    component.newGroupName = 'NewGroup';
    component.currentUser = 'admin';
    component.createGroup();
    expect(mockChatService.createGroup).toHaveBeenCalledWith({
      groupName: 'NewGroup',
      admin: 'admin',
    });
    expect(component.newGroupName).toBe('');
  });

  it('should add user to group', () => {
    const group = { name: 'testGroup', members: [] };
    component.addUser(group, 'newUser');
    expect(mockChatService.addUserToGroup).toHaveBeenCalledWith({
      groupName: 'testGroup',
      username: 'newUser',
    });
  });

  it('should handle typing status for private chat', () => {
    component.selectedUser = 'testUser';
    component.onTyping();
    expect(mockChatService.emitTyping).toHaveBeenCalledWith('testUser', true);
  });

  it('should handle typing status for group chat', () => {
    component.selectedGroup = { name: 'testGroup', members: [] };
    component.onTypingGroup();
    expect(mockChatService.emitGroupTyping).toHaveBeenCalledWith('testGroup', true);
  });

  it('should select user and fetch chat history', () => {
    const mockMessages = [
      { sender: 'user1', receiver: 'currentUser', message: 'Hello', timestamp: new Date() },
    ];
    (mockChatService.getChatHistory as jest.Mock).mockReturnValue(of(mockMessages));

    component.currentUser = 'currentUser';
    component.selectUser('user1');

    expect(component.selectedUser).toBe('user1');
    expect(mockChatService.markMessagesAsRead).toHaveBeenCalledWith('currentUser', 'user1');
    expect(mockChatService.getChatHistory).toHaveBeenCalledWith('currentUser', 'user1');
    expect(component.messages.length).toBe(1);
  });

  it('should handle add group user visibility', () => {
    component.users = [{ username: 'user1' }, { username: 'user2' }];
    component.selectedGroup = { name: 'group1', members: ['user1'] };

    component.toggleAddGroupUser();
    expect(component.showAddGroupUser).toBe(true);
    expect(component.filteredUsers.length).toBe(1);
    expect(component.filteredUsers[0].username).toBe('user2');
  });

  it('should handle empty message', () => {
    component.message = '   ';
    component.sendMessage();
    expect(mockChatService.sendPrivateMessage).not.toHaveBeenCalled();
    expect(mockChatService.sendGroupMessage).not.toHaveBeenCalled();
  });

  it('should handle empty group name', () => {
    component.newGroupName = '   ';
    component.createGroup();
    expect(mockChatService.createGroup).not.toHaveBeenCalled();
  });

  it('should handle null selected user', () => {
    component.selectedUser = null;
    component.message = 'Hello';
    component.sendMessage();
    expect(mockChatService.sendPrivateMessage).not.toHaveBeenCalled();
  });

  it('should handle null selected group', () => {
    component.selectedGroup = null;
    component.message = 'Hello Group';
    component.sendMessage();
    expect(mockChatService.sendGroupMessage).not.toHaveBeenCalled();
  });

  it('should handle null selected user for typing', () => {
    component.selectedUser = null;
    component.onTyping();
    expect(mockChatService.emitTyping).not.toHaveBeenCalled();
  });

  it('should handle null selected group for typing', () => {
    component.selectedGroup = null;
    component.onTypingGroup();
    expect(mockChatService.emitGroupTyping).not.toHaveBeenCalled();
  });

  it('should handle socket events', () => {
    const mockMessage = { sender: 'user1', message: 'Hello' };
    (mockChatService.getMessages as jest.Mock).mockReturnValue(of([mockMessage]));
    component.ngOnInit();
    expect(component.messages).toContain(mockMessage);
  });

  it('should handle typing status updates', () => {
    const mockTypingStatus = { isTyping: true, user: 'user1' };
    (mockChatService.getTypingStatus as jest.Mock).mockReturnValue(of(mockTypingStatus));
    component.ngOnInit();
    expect(component.typing).toBe(true);
    expect(component.typingUser).toBe('user1');
  });

  it('should handle online users updates', () => {
    const mockOnlineUsers = ['user1', 'user2'];
    (mockChatService.getOnlineUsers as jest.Mock).mockReturnValue(of(mockOnlineUsers));
    component.ngOnInit();
    expect(component.onlineUsers).toEqual(mockOnlineUsers);
  });

  it('should handle unread message count updates', () => {
    const mockUnreadCount = { unreadCount: 5 };
    (mockChatService.getUnreadMessageCount as jest.Mock).mockReturnValue(of(mockUnreadCount));
    component.ngOnInit();
    expect(component.totalUnreadCount).toBe(5);
  });

  it('should handle group unread count updates', () => {
    const mockUnreadCount = { unreadCount: 3 };
    (mockChatService.getGroupUnreadCount as jest.Mock).mockReturnValue(of(mockUnreadCount));
    component.ngOnInit();
    expect(component.totalUnreadCount).toBe(3);
  });

  it('should handle group chat history', () => {
    const mockMessages = [
      { sender: 'user1', message: 'Hello', timestamp: new Date() },
    ];
    (mockChatService.getGroupChatHistory as jest.Mock).mockReturnValue(of(mockMessages));

    component.currentUser = 'currentUser';
    component.selectGroup({ name: 'group1', members: [] });

    expect(component.selectedGroup).toEqual({ name: 'group1', members: [] });
    expect(mockChatService.markGroupMessagesAsRead).toHaveBeenCalledWith('group1', 'currentUser');
    expect(mockChatService.getGroupChatHistory).toHaveBeenCalledWith('group1');
    expect(component.messages.length).toBe(1);
  });

  it('should handle menu toggle', () => {
    component.isMenuOpen = false;
    component.toggleMenu();
    expect(component.isMenuOpen).toBe(true);
    component.toggleMenu();
    expect(component.isMenuOpen).toBe(false);
  });

  it('should handle create group modal', () => {
    component.showCreateGroupModal = false;
    component.openCreateGroupModal();
    expect(component.showCreateGroupModal).toBe(true);
    component.closeCreateGroupModal();
    expect(component.showCreateGroupModal).toBe(false);
  });

  it('should handle document click for menu', () => {
    component.isMenuOpen = true;
    const mockEvent = { target: document.createElement('div') } as unknown as MouseEvent;
    component.onDocumentClick(mockEvent);
    expect(component.isMenuOpen).toBe(false);
  });
});
