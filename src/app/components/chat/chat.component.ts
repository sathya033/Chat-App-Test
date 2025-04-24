import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

// Add interface for Message type at the top of the file
interface ChatMessage {
  sender: string;
  receiver?: string;
  group?: string;
  message: string;
  timestamp: string | Date;
  isRead?: boolean;
  readBy?: string[]; // Add readBy for group messages
}

interface Group {
  name: string;
  members: string[];
  unreadCount?: number;
  admin?: string;
  lastMessageTime?: Date;  // Add this property
}

@Component({
  selector: 'app-chat',
  standalone: false,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatBody') chatBody!: ElementRef;
  @ViewChild('groupChatBody') groupChatBody!: ElementRef;

  private subscriptions: Subscription[] = [];
  private shouldScrollToBottom = false;
  users: { username: string; unreadCount?: number; lastMessageTime?: Date }[] = [];
  groups: Group[] = [];
  messages: ChatMessage[] = [];
  viewMode: 'users' | 'groups' = 'users';
  currentUser: string = '';
  isOpen = false;
  totalUnreadCount = 0;
  typing = false;
  typingUser = '';
  showAddGroupUser = false;
  filteredUsers: { username: string; unreadCount?: number; lastMessageTime?: Date }[] = [];
  groupMembers: string[] = [];
  onlineUsers: string[] = [];

  selectedUser: string | null = null;
  selectedGroup: any;
  message = '';
  newGroupName = '';
  admin = '';
  userSearchTerm: string = '';
  groupSearchTerm: string = '';
  filteredGroups: Group[] = [];
  isMenuOpen = false;
  showCreateGroupModal = false;

  // Add caching variables
  private userCache: { [key: string]: any } = {};
  private groupCache: { [key: string]: any } = {};
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds cache
  private messageSubscription: Subscription | null = null;
  private typingSubscription: Subscription | null = null;
  private onlineUsersSubscription: Subscription | null = null;

  constructor(private http: HttpClient, private chatService: ChatService) {}

  ngOnInit(): void {
    this.currentUser = localStorage.getItem('currentUser') || '';
    console.log('Logged-in user:', this.currentUser);

    // Check if notifications are supported and request permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission);
      });
    }

    // Initialize socket connection
    this.chatService.initializeSocket(this.currentUser);

    // Initial fetch
    this.fetchUsers();
    this.fetchGroups();
    this.setupSubscriptions();
  }

  private shouldFetch(): boolean {
    const now = Date.now();
    return now - this.lastFetchTime > this.CACHE_DURATION;
  }

  private fetchUsers() {
    if (!this.shouldFetch() && Object.keys(this.userCache).length > 0) {
      this.users = Object.values(this.userCache);
      this.filteredUsers = [...this.users];
      return;
    }

    this.chatService.getUsers().subscribe(
      (users) => {
        // Cache the users
        this.userCache = users.reduce((acc, user) => {
          acc[user.username] = user;
          return acc;
        }, {} as { [key: string]: any });

        this.users = users.filter(user => user.username.trim() !== this.currentUser.trim())
          .map(user => ({ ...user, lastMessageTime: undefined }));
        this.filteredUsers = [...this.users];
        this.lastFetchTime = Date.now();

        // Get unread counts only for users with messages
        this.users.forEach(user => {
          if (user.unreadCount) {
            this.updateUserUnreadCount(user.username);
          }
        });
      },
      (error) => console.error('Error fetching users:', error)
    );
  }

  private fetchGroups() {
    if (!this.shouldFetch() && Object.keys(this.groupCache).length > 0) {
      this.groups = Object.values(this.groupCache);
      this.filteredGroups = [...this.groups];
      return;
    }

    console.log('Fetching groups for user:', this.currentUser);
    this.chatService.getGroups(this.currentUser).subscribe(
      (groups) => {
        // Cache the groups
        this.groupCache = groups.reduce((acc, group) => {
          acc[group.name] = group;
          return acc;
        }, {} as { [key: string]: any });

        this.groups = groups;
        this.filteredGroups = [...this.groups];
        this.lastFetchTime = Date.now();

        // Get unread counts only for groups with messages
        this.groups.forEach(group => {
          if (group.unreadCount) {
            this.updateGroupUnreadCount(group.name);
          }
        });
      },
      (error) => {
        console.error('Error fetching groups:', error);
        this.groups = [];
        this.filteredGroups = [];
      }
    );
  }

  private updateUserUnreadCount(username: string) {
    this.chatService.getUnreadMessageCount(this.currentUser).subscribe(
      (response) => {
        if (response && typeof response.unreadCount === 'number') {
          const user = this.users.find(u => u.username === username);
          if (user) {
            user.unreadCount = response.unreadCount;
            this.updateTotalUnreadCount();
          }
        }
      },
      (error) => console.error('Error fetching unread count:', error)
    );
  }

  private updateGroupUnreadCount(groupName: string) {
    this.chatService.getGroupUnreadCount(groupName, this.currentUser).subscribe(
      (response) => {
        if (response && typeof response.unreadCount === 'number') {
          const group = this.groups.find(g => g.name === groupName);
          if (group && (!this.selectedGroup || groupName !== this.selectedGroup.name)) {
            group.unreadCount = response.unreadCount;
            this.updateTotalUnreadCount();
          }
        }
      },
      (error) => console.error('Error fetching group unread count:', error)
    );
  }

  private setupSubscriptions(): void {
    // Clean up existing subscriptions
    this.cleanupSubscriptions();

    // Subscribe to messages with debounce
    this.messageSubscription = this.chatService.getMessages()
      .pipe(debounceTime(300))
      .subscribe(messages => {
        if (messages && messages.length > 0) {
          this.processMessages(messages);
        }
      });

    // Subscribe to typing status
    this.typingSubscription = this.chatService.getTypingStatus()
      .pipe(debounceTime(300))
      .subscribe(status => {
        this.typing = status.isTyping;
        this.typingUser = status.user;
      });

    // Subscribe to online users
    this.onlineUsersSubscription = this.chatService.getOnlineUsers()
      .pipe(debounceTime(1000))
      .subscribe(users => {
        this.onlineUsers = users;
      });
  }

  private cleanupSubscriptions(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
    if (this.typingSubscription) {
      this.typingSubscription.unsubscribe();
    }
    if (this.onlineUsersSubscription) {
      this.onlineUsersSubscription.unsubscribe();
    }
  }

  private processMessages(messages: ChatMessage[]): void {
    // Update last message time for all messages
    messages.forEach(msg => {
      if (msg.sender === this.currentUser && msg.receiver) {
        this.updateUserLastMessageTime(msg.sender, msg.receiver, new Date(msg.timestamp));
      } else if (msg.receiver === this.currentUser) {
        this.updateUserLastMessageTime(msg.sender, msg.receiver, new Date(msg.timestamp));
      }
    });

    // Filter messages based on selected user or group
    const filteredMessages = messages.filter((msg: ChatMessage) => {
      if (this.selectedUser) {
        return (msg.sender === this.currentUser && msg.receiver === this.selectedUser) ||
              (msg.sender === this.selectedUser && msg.receiver === this.currentUser);
      } else if (this.selectedGroup?.name) {
        return msg.group === this.selectedGroup.name;
      }
      return false;
    });

    // Remove duplicates and sort messages
    const uniqueMessages = this.removeDuplicateMessages(filteredMessages);
    this.messages = this.sortMessagesByTimestamp(uniqueMessages);
    this.shouldScrollToBottom = true;
    setTimeout(() => this.scrollToBottom(), 100);

    // Update unread counts
    this.updateUnreadCounts(messages);
  }

  ngOnDestroy(): void {
    this.cleanupSubscriptions();
    this.chatService.disconnect();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  private updateTotalUnreadCount(): void {
    const userUnreadCount = this.users.reduce((total, user) => total + (user.unreadCount || 0), 0);
    const groupUnreadCount = this.groups.reduce((total, group) => total + (group.unreadCount || 0), 0);
    this.totalUnreadCount = userUnreadCount + groupUnreadCount;
  }

  private removeDuplicateMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.reduce((acc: ChatMessage[], curr: ChatMessage) => {
      const isDuplicate = acc.some(msg =>
        msg.sender === curr.sender &&
        msg.message === curr.message &&
        (curr.receiver ? msg.receiver === curr.receiver : true) &&
        (curr.group ? msg.group === curr.group : true) &&
        new Date(msg.timestamp).getTime() === new Date(curr.timestamp).getTime()
      );
      if (!isDuplicate) {
        acc.push(curr);
      }
      return acc;
    }, []);
  }

  private sortMessagesByTimestamp(messages: ChatMessage[]): ChatMessage[] {
    return messages.sort((a: ChatMessage, b: ChatMessage) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  //search
  private filterUsers(): void {
    if (!this.userSearchTerm) {
      this.filteredUsers = [...this.users];
      return;
    }
    const searchTerm = this.userSearchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(user =>
      user.username.toLowerCase().includes(searchTerm)
    );
  }

  private filterGroups(): void {
    if (!this.groupSearchTerm) {
      this.filteredGroups = this.groups;
      return;
    }
    const searchTerm = this.groupSearchTerm.toLowerCase();
    this.filteredGroups = this.groups.filter(group =>
      group.name.toLowerCase().includes(searchTerm)
    );
  }

  onUserSearch(): void {
    this.filterUsers();
  }

  onGroupSearch(): void {
    this.filterGroups();
  }

  toggleToUsers() {
    this.viewMode = 'users';
    this.selectedGroup = null;
    this.selectedUser = null;  // Clear selected user when switching to users view
    this.messages = [];  // Clear messages
    this.fetchUsers();  // Refresh user list
  }

  toggleToGroups() {
    this.viewMode = 'groups';
    this.selectedUser = null;
    this.selectedGroup = null;  // Clear selected group when switching to groups view
    this.messages = [];  // Clear messages
    this.fetchGroups();  // Refresh group list
  }

  selectUser(username: string) {
    this.selectedUser = username;
    this.selectedGroup = null;
    this.messages = [];

    // Mark messages as read when selecting a user
    this.chatService.markMessagesAsRead(this.currentUser, username).subscribe(
      () => {
        // Update unread count for this user
        const user = this.users.find(u => u.username === username);
        if (user) {
          user.unreadCount = 0;
          this.updateTotalUnreadCount();
        }
      },
      (error) => console.error('Error marking messages as read:', error)
    );

    // Fetch chat history and update last message time
    this.chatService.getChatHistory(this.currentUser, username).subscribe(
      (history) => {
        this.messages = history.filter((msg: ChatMessage) =>
          (msg.sender === this.currentUser && msg.receiver === username) ||
          (msg.sender === username && msg.receiver === this.currentUser)
        );
        if (this.messages.length > 0) {
          const lastMessage = this.messages[this.messages.length - 1];
          this.updateUserLastMessageTime(
            lastMessage.sender,
            lastMessage.receiver || '',
            new Date(lastMessage.timestamp)
          );
        }
        this.shouldScrollToBottom = true;
      },
      (error) => console.error('Error fetching private chat history:', error)
    );
  }

  selectGroup(group: Group) {
    this.selectedGroup = group;
    this.selectedUser = null;
    this.messages = [];
    this.showAddGroupUser = false;

    // Mark messages as read when selecting a group
    this.chatService.markGroupMessagesAsRead(group.name, this.currentUser).subscribe(
      () => {
        const selectedGroup = this.groups.find(g => g.name === group.name);
        if (selectedGroup) {
          selectedGroup.unreadCount = 0;
          this.updateTotalUnreadCount();
        }
      },
      (error) => console.error('Error marking group messages as read:', error)
    );

    // Join the group socket room
    this.chatService.joinGroup(group.name);

    // Fetch group chat history
    this.chatService.getGroupChatHistory(group.name).subscribe(
      (history) => {
        // Filter messages for this group and sort by timestamp
        this.messages = this.sortMessagesByTimestamp(
          history.filter((msg: ChatMessage) => msg.group === group.name)
        );

        // Update the group's last message time
        if (this.messages.length > 0) {
          const lastMessage = this.messages[this.messages.length - 1];
          const foundGroup = this.groups.find(g => g.name === group.name);
          if (foundGroup) {
            foundGroup.lastMessageTime = new Date(lastMessage.timestamp);
            this.sortGroupsByLastMessage();
          }
        }

        this.shouldScrollToBottom = true;
        setTimeout(() => this.scrollToBottom(), 100);
      },
      (error) => {
        console.error('Error fetching group chat history:', error);
      }
    );
  }

  sendMessage() {
    if (!this.message.trim()) return;

    const timestamp = new Date();
    if (this.selectedUser) {
      this.chatService.sendPrivateMessage(this.selectedUser, this.message);
      // Update last message time immediately for better UX
      this.updateUserLastMessageTime(this.currentUser, this.selectedUser, timestamp);
    } else if (this.selectedGroup) {
      this.chatService.sendGroupMessage(this.selectedGroup.name, this.message);
      // Update group's last message time
      const foundGroup: Group | undefined = this.groups.find(g => g.name === this.selectedGroup.name);
      if (foundGroup) {
        foundGroup.lastMessageTime = timestamp;
        this.sortGroupsByLastMessage();
      }
    }

    this.message = '';
    this.shouldScrollToBottom = true;
  }

  onTyping() {
    if (this.selectedUser) {
      this.chatService.emitTyping(this.selectedUser, true);

      setTimeout(() => {
        if (this.selectedUser) {
          this.chatService.emitTyping(this.selectedUser, false);
        }
      }, 700);
    }
  }

  createGroup() {
    if (!this.newGroupName.trim()) {
      return;
    }

    console.log('Creating new group:', this.newGroupName);
    const groupData = {
      groupName: this.newGroupName.trim(),
      admin: this.currentUser,
    };

    this.chatService.createGroup(groupData).subscribe(
      (response) => {
        console.log('Group created successfully:', response);
        this.fetchGroups();
        this.closeCreateGroupModal();
      },
      (error) => {
        console.error('Error creating group:', error);
        this.closeCreateGroupModal();
      }
    );
  }

  addUser(selectedGroup: any, username: string) {
    console.log('Adding user to group:', { group: selectedGroup.name, user: username });
    const data = {
      groupName: selectedGroup.name,
      username: username,
    };

    this.chatService.addUserToGroup(data).subscribe(
      (response) => {
        console.log('User added to group successfully:', response);
        this.fetchGroups();
        this.toggleAddGroupUser();
      },
      (error) => {
        console.error('Error adding user to group:', error);

      }
    );
  }

  toggleAddGroupUser() {
    this.filteredUsers = this.users.filter(user => !this.selectedGroup.members.includes(user.username));
    this.showAddGroupUser = !this.showAddGroupUser;
  }

  toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.totalUnreadCount = 0;
    }
  }

  onTypingGroup() {
    if (this.selectedGroup?.name) {  // Use optional chaining
      this.chatService.emitGroupTyping(this.selectedGroup.name, true);

      // Stop typing indicator after 2 seconds
      setTimeout(() => {
        if (this.selectedGroup?.name) {  // Check if still in the same group
          this.chatService.emitGroupTyping(this.selectedGroup.name, false);
        }
      }, 500);
    }
  }

  private scrollToBottom(): void {
    try {
      // Scroll private chat
      if (this.chatBody && this.selectedUser) {
        const element = this.chatBody.nativeElement;
        element.scrollTop = element.scrollHeight;
      }

      // Scroll group chat
      if (this.groupChatBody && this.selectedGroup) {
        const element = this.groupChatBody.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  // Add this method to count contacts with unread messages
  getUnreadContactsCount(): number {
    const usersWithUnread = this.users.filter(user => (user.unreadCount || 0) > 0).length;
    const groupsWithUnread = this.groups.filter(group => (group.unreadCount || 0) > 0).length;
    return usersWithUnread + groupsWithUnread;
  }

  private updateUnreadCounts(messages: ChatMessage[]): void {
    // Get the latest message
    const latestMessage = messages[messages.length - 1];

    // Update unread count for private messages
    if (latestMessage.receiver === this.currentUser &&
        latestMessage.sender !== this.selectedUser &&
        latestMessage.sender !== this.currentUser) {
      const user = this.users.find(u => u.username === latestMessage.sender);
      if (user) {
        user.unreadCount = (user.unreadCount || 0) + 1;
        this.updateTotalUnreadCount();
      }
    }

    // Update unread count for group messages
    if (latestMessage.group &&
        latestMessage.sender !== this.currentUser &&
        (!latestMessage.readBy?.includes(this.currentUser))) {
      const group = this.groups.find(g => g.name === latestMessage.group);
      // Only increment unread count if not currently viewing this group
      if (group && (!this.selectedGroup || latestMessage.group !== this.selectedGroup.name)) {
        group.unreadCount = (group.unreadCount || 0) + 1;
        this.updateTotalUnreadCount();
      }
    }
  }

  private updateUserLastMessageTime(sender: string, receiver: string, timestamp: Date): void {
    const targetUser = sender === this.currentUser ? receiver : sender;
    const user = this.users.find(u => u.username === targetUser);
    if (user) {
      user.lastMessageTime = timestamp;
      // Immediately sort users after updating the timestamp
      this.sortUsersByLastMessage();
    }
  }

  private sortUsersByLastMessage(): void {
    // Create a new array to trigger change detection
    this.users = [...this.users].sort((a, b) => {
      // If both have lastMessageTime, sort by time (newest first)
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      }
      // If only one has lastMessageTime, put it first
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;
      // If neither has lastMessageTime, maintain current order
      return 0;
    });
    // Update filtered users to maintain the same order
    this.filteredUsers = [...this.users];
  }

  private sortGroupsByLastMessage(): void {
    this.groups.sort((a, b) => {
      // If both have lastMessageTime, sort by time (newest first)
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      }
      // If only one has lastMessageTime, put it first
      if (a.lastMessageTime) return -1;
      if (b.lastMessageTime) return 1;
      // If neither has lastMessageTime, maintain current order
      return 0;
    });
    // Update filtered groups to maintain the same order
    this.filteredGroups = [...this.groups];
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  openCreateGroupModal() {
    this.isMenuOpen = false;
    this.showCreateGroupModal = true;
  }

  closeCreateGroupModal() {
    this.showCreateGroupModal = false;
    this.newGroupName = '';
  }

  // Close menu when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const menuContainer = document.querySelector('.menu-container');
    if (menuContainer && !menuContainer.contains(event.target as Node)) {
      this.isMenuOpen = false;
    }
  }
}
